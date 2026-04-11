function normalizeMetricDefinitions(definitions) {
  if (!definitions || typeof definitions !== "object" || Array.isArray(definitions)) {
    throw new Error("metrics recorder definitions must be an object");
  }

  const normalized = {};
  for (const [metricName, rawDefinition] of Object.entries(definitions)) {
    if (typeof metricName !== "string" || metricName.trim() === "") {
      throw new Error("metrics recorder metric names must be non-empty strings");
    }
    if (!rawDefinition || typeof rawDefinition !== "object" || Array.isArray(rawDefinition)) {
      throw new Error(`metrics recorder definition for ${metricName} must be an object`);
    }
    if (rawDefinition.kind !== "counter" && rawDefinition.kind !== "histogram") {
      throw new Error(`metrics recorder unsupported metric kind for ${metricName}: ${rawDefinition.kind}`);
    }

    normalized[metricName] = {
      kind: rawDefinition.kind,
      description: String(rawDefinition.description || metricName),
      unit: String(rawDefinition.unit || (rawDefinition.kind === "counter" ? "count" : "value")),
      labels: Array.isArray(rawDefinition.labels)
        ? rawDefinition.labels.map((label) => String(label)).sort()
        : [],
    };
  }
  return normalized;
}

function normalizeMetricLabels(metricName, metricDefinition, labelsInput) {
  if (!labelsInput || typeof labelsInput !== "object" || Array.isArray(labelsInput)) {
    if (metricDefinition.labels.length === 0) {
      return {};
    }
    throw new Error(`metrics recorder ${metricName} labels must be an object`);
  }

  const labels = {};
  const expected = new Set(metricDefinition.labels);
  for (const labelName of metricDefinition.labels) {
    const rawValue = labelsInput[labelName];
    if (rawValue == null || String(rawValue) === "") {
      throw new Error(`metrics recorder ${metricName} missing label: ${labelName}`);
    }
    labels[labelName] = String(rawValue);
  }

  for (const labelName of Object.keys(labelsInput)) {
    if (!expected.has(labelName)) {
      throw new Error(`metrics recorder ${metricName} unexpected label: ${labelName}`);
    }
  }

  return labels;
}

function windowStartISOString(timestampMs, windowMs) {
  const start = Math.floor(timestampMs / windowMs) * windowMs;
  return new Date(start).toISOString();
}

function cloneMetricRow(entry) {
  const row = {
    metric: entry.metric,
    kind: entry.kind,
    windowStart: entry.windowStart,
    labels: { ...entry.labels },
    count: entry.count,
    sum: entry.sum,
  };
  if (entry.kind === "histogram") {
    row.values = [...entry.values];
  }
  return row;
}

export function createMetricsRecorder(metricsClient, options = {}) {
  if (!metricsClient || typeof metricsClient !== "object") {
    throw new Error("metrics recorder requires a metrics client");
  }

  const accessToken = typeof options.accessToken === "string" ? options.accessToken.trim() : "";
  if (accessToken === "") {
    throw new Error("metrics recorder accessToken is required");
  }

  const metricSet = typeof options.metricSet === "string" ? options.metricSet.trim() : "";
  if (metricSet === "") {
    throw new Error("metrics recorder metricSet is required");
  }

  const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0
    ? Math.floor(options.windowMs)
    : 1000;

  const definitions = normalizeMetricDefinitions(options.definitions);
  const state = {
    accessToken,
    metricSet,
    windowMs,
    definitions,
    buffer: new Map(),
    ensureStarted: false,
    ensurePromise: Promise.resolve(),
    flushPromise: Promise.resolve(),
  };

  const recorder = {
    flush() {
      state.flushPromise = state.flushPromise.then(async () => {
        await ensureMetricSet(state, metricsClient);
        const rows = collectRows(state);
        if (rows.length === 0) {
          return;
        }
        await metricsClient.metricSets.appendRows(state.accessToken, state.metricSet, rows);
      });
      return state.flushPromise;
    },
  };

  for (const [metricName, metricDefinition] of Object.entries(definitions)) {
    if (metricDefinition.kind === "counter") {
      recorder[metricName] = {
        inc(valueOrLabels = 1, maybeLabels = {}) {
          let amount = 1;
          let labels = maybeLabels;
          if (typeof valueOrLabels === "object" && valueOrLabels !== null && !Array.isArray(valueOrLabels)) {
            labels = valueOrLabels;
          } else {
            amount = Number(valueOrLabels);
          }
          if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error(`metrics recorder ${metricName}.inc value must be a positive number`);
          }
          recordMetric(state, metricsClient, metricName, metricDefinition, amount, labels);
        },
      };
      continue;
    }

    recorder[metricName] = {
      observe(value, labels = {}) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) {
          throw new Error(`metrics recorder ${metricName}.observe value must be a finite number`);
        }
        recordMetric(state, metricsClient, metricName, metricDefinition, amount, labels);
      },
    };
  }

  return recorder;
}

function recordMetric(state, metricsClient, metricName, metricDefinition, value, labelsInput) {
  ensureMetricSet(state, metricsClient);
  const labels = normalizeMetricLabels(metricName, metricDefinition, labelsInput);
  const windowStart = windowStartISOString(Date.now(), state.windowMs);
  const bufferKey = `${metricName}:${metricDefinition.kind}:${windowStart}:${JSON.stringify(labels)}`;
  let entry = state.buffer.get(bufferKey);
  if (!entry) {
    entry = {
      metric: metricName,
      kind: metricDefinition.kind,
      windowStart,
      labels,
      count: 0,
      sum: 0,
    };
    if (metricDefinition.kind === "histogram") {
      entry.values = [];
    }
    state.buffer.set(bufferKey, entry);
  }

  entry.count += 1;
  entry.sum += value;
  if (metricDefinition.kind === "histogram") {
    entry.values.push(value);
  }
}

function ensureMetricSet(state, metricsClient) {
  if (state.ensureStarted) {
    return state.ensurePromise;
  }

  state.ensureStarted = true;
  state.ensurePromise = Promise.resolve(
    metricsClient.metricSets.ensure(state.accessToken, state.metricSet, state.definitions),
  );
  return state.ensurePromise;
}

function collectRows(state) {
  const rows = [];
  for (const [bufferKey, entry] of Array.from(state.buffer.entries())) {
    rows.push(cloneMetricRow(entry));
    state.buffer.delete(bufferKey);
  }
  rows.sort((left, right) => left.windowStart.localeCompare(right.windowStart) || left.metric.localeCompare(right.metric));
  return rows;
}
