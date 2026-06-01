function rebuildFromFullSnapshot_(existingState, currentByKey, scope) {
  const groups = [];
  const processedKeys = new Set();

  const sortedCurrent = Array.from(currentByKey.values()).sort(compareImportedEvents_);

  sortedCurrent.forEach((currentEvent) => {
    const existingRows = existingState.rowsByEventKey.get(currentEvent.eventKey) || [];
    const group = buildGroupForCurrentEvent_(existingRows, currentEvent);
    if (group) {
      groups.push(group);
    }
    processedKeys.add(currentEvent.eventKey);
  });

  existingState.rowsByEventKey.forEach((existingRows, eventKey) => {
    if (processedKeys.has(eventKey)) {
      return;
    }

    const group = buildGroupForMissingCurrent_(existingRows);
    if (group) {
      groups.push(group);
    }
  });

  existingState.ignoredManagedRows.forEach((row) => {
    groups.push(buildGroupFromRows_([cloneRowModel_(row)]));
  });

  existingState.unmanagedRows.forEach((row) => {
    groups.push(buildGroupFromRows_([cloneRowModel_(row)]));
  });

  groups.sort(compareGroups_);
  return flattenGroups_(groups);
}

function rebuildFromIncremental_(existingState, deltaByKey, scope) {
  const groupsByKey = new Map();

  existingState.rowsByEventKey.forEach((rows, eventKey) => {
    const cloned = rows.map((row) => cloneRowModel_(row));
    const group = buildGroupFromRows_(cloned);
    if (group) {
      groupsByKey.set(eventKey, group);
    }
  });

  existingState.ignoredManagedRows.forEach((row) => {
    groupsByKey.set(`__IGNORED__${row.eventKey}`, buildGroupFromRows_([cloneRowModel_(row)]));
  });

  existingState.unmanagedRows.forEach((row) => {
    groupsByKey.set(row.syntheticKey, buildGroupFromRows_([cloneRowModel_(row)]));
  });

  deltaByKey.forEach((currentEvent, eventKey) => {
    const existingRows = existingState.rowsByEventKey.get(eventKey) || [];

    if (currentEvent && !isManagedEventInScope_(currentEvent, scope)) {
      return;
    }

    let group = null;
    if (currentEvent) {
      group = buildGroupForCurrentEvent_(existingRows, currentEvent);
    } else {
      group = buildGroupForMissingCurrent_(existingRows);
    }

    if (group && group.rows.length > 0) {
      groupsByKey.set(eventKey, group);
    } else {
      groupsByKey.delete(eventKey);
    }
  });

  const groups = Array.from(groupsByKey.values()).filter(Boolean);
  groups.sort(compareGroups_);
  return flattenGroups_(groups);
}

function buildGroupForCurrentEvent_(existingRows, currentEvent) {
  return buildGroupFromRows_([
    buildNewRowFromImport_(currentEvent, '', '', '', '', CONFIG.rowKind.normal),
  ]);
}

function buildGroupForMissingCurrent_(existingRows) {
  return null;
}

function buildGroupFromRows_(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }

  return {
    anchor: extractAnchorFromRow_(rows[0]),
    rows,
  };
}

function flattenGroups_(groups) {
  const rows = [];
  groups.forEach((group) => {
    group.rows.forEach((row) => rows.push(row));
  });
  return rows;
}

function compareGroups_(a, b) {
  const byDate = a.anchor.date - b.anchor.date;
  if (byDate !== 0) {
    return byDate;
  }

  const byStart = a.anchor.start - b.anchor.start;
  if (byStart !== 0) {
    return byStart;
  }

  const byEnd = a.anchor.end - b.anchor.end;
  if (byEnd !== 0) {
    return byEnd;
  }

  return a.anchor.text.localeCompare(b.anchor.text);
}

function compareImportedEvents_(a, b) {
  const byDate = a.date.getTime() - b.date.getTime();
  if (byDate !== 0) {
    return byDate;
  }

  const byStart = a.start.getTime() - b.start.getTime();
  if (byStart !== 0) {
    return byStart;
  }

  const byEnd = a.end.getTime() - b.end.getTime();
  if (byEnd !== 0) {
    return byEnd;
  }

  return a.eventKey.localeCompare(b.eventKey);
}

function buildUpdatedRowFromImport_(existingRow, currentEvent) {
  const values = currentEvent.values.slice();

  return {
    eventKey: currentEvent.eventKey,
    rowKind: CONFIG.rowKind.normal,
    invoiceNumber: currentEvent.invoiceNumber || '',
    signature: currentEvent.signature,
    values,
  };
}

function buildNewRowFromImport_(currentEvent, customer, project, invoiceNumber, invoiceDate, rowKind) {
  const values = currentEvent.values.slice();
  const rowInvoiceNumber = invoiceNumber || currentEvent.invoiceNumber || '';

  if (values.length > 8) {
    values[6] = customer || '';
    values[7] = project || '';
    values[8] = rowInvoiceNumber;
    values[9] = invoiceDate || '';
  }

  return {
    eventKey: currentEvent.eventKey,
    rowKind,
    invoiceNumber: rowInvoiceNumber,
    signature: currentEvent.signature,
    values,
  };
}

function extractAnchorFromRow_(row) {
  const date = row.values[2] instanceof Date ? row.values[2].getTime() : Number.MAX_SAFE_INTEGER;
  const start = row.values[3] instanceof Date ? row.values[3].getTime() : Number.MAX_SAFE_INTEGER;
  const end = row.values[4] instanceof Date ? row.values[4].getTime() : Number.MAX_SAFE_INTEGER;

  return {
    date,
    start,
    end,
    text: `${toText_(row.values[0])}|${toText_(row.values[1])}|${toText_(row.eventKey || row.syntheticKey || '')}`,
  };
}
