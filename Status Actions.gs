function filterCalendarForOpen() {
  filterCalendarByStatus_('Open');
}

function filterCalendarForInvoiced() {
  filterCalendarByStatus_('Invoiced');
}

function filterCalendarForNonBillable() {
  filterCalendarByStatus_('Non-billable');
}

function markSelectedCalendarRowsAsInvoiced() {
  refreshConfig_();
  markSelectedCalendarRows_(CONFIG.invoicingSheetName);
}

function markSelectedCalendarRowsAsNonBillable() {
  refreshConfig_();
  markSelectedCalendarRows_(CONFIG.nonBillableSheetName);
}

function filterCalendarByStatus_(statusValue) {
  refreshConfig_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const spreadsheetId = ss.getId();
  const managedSheets = ensureManagedWorkbookStructure_(ss, spreadsheetId);
  const sheet = managedSheets.sheet;

  const statusColumn = CONFIG.header.indexOf('Status') + 1;
  if (statusColumn <= 0) {
    throw new Error('Calendar Status column is not configured.');
  }

  clearManualCalendarStatusFilter_(sheet);

  try {
    const range = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), CONFIG.header.length);
    let filter = sheet.getFilter();
    if (!filter) {
      filter = range.createFilter();
    }

    const criteria = SpreadsheetApp.newFilterCriteria().whenTextEqualTo(statusValue).build();
    filter.setColumnFilterCriteria(statusColumn, criteria);
  } catch (error) {
    applyManualCalendarStatusFilter_(sheet, statusValue, statusColumn);
  }

  showToastMessage_(ss, `Filtered Calendar for ${statusValue}.`, { severity: 'info' });
}

function clearManualCalendarStatusFilter_(sheet) {
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (rowCount > 0) {
    sheet.showRows(2, rowCount);
  }
}

function applyManualCalendarStatusFilter_(sheet, statusValue, statusColumn) {
  const rowCount = Math.max(sheet.getLastRow() - 1, 0);
  if (rowCount === 0) {
    return;
  }

  const statuses = sheet.getRange(2, statusColumn, rowCount, 1).getDisplayValues();
  statuses.forEach((row, index) => {
    if (row[0] !== statusValue) {
      sheet.hideRows(index + 2);
    }
  });
}

function markSelectedCalendarRows_(targetSheetName) {
  refreshConfig_();

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheetId = ss.getId();
    const managedSheets = ensureManagedWorkbookStructure_(ss, spreadsheetId);
    const selectedRows = collectSelectedCalendarRows_(ss, managedSheets.sheet, managedSheets.stateSheet);

    if (selectedRows.length === 0) {
      showToastMessage_(ss, 'No selected Calendar rows to mark.', { severity: 'info' });
      return;
    }

    showMarkProgress_(ss, targetSheetName, 0, selectedRows.length, 'Preparing selected rows');

    let markedCount = 0;
    let removedCount = 0;
    if (targetSheetName === CONFIG.invoicingSheetName) {
      markedCount = appendCalendarRowsToInvoicing_(
        selectedRows,
        managedSheets.invoicingSheet,
        managedSheets.invoicingStateSheet,
        (done, total) => showMarkProgress_(ss, targetSheetName, done, total, 'Preparing register rows')
      );
      showMarkProgress_(ss, targetSheetName, selectedRows.length, selectedRows.length, 'Removing moved rows');
      removedCount = removeRegisterRowsByEventKeys_(
        managedSheets.nonBillableSheet,
        managedSheets.nonBillableStateSheet,
        CONFIG.nonBillableHeader,
        CONFIG.nonBillableStateHeader,
        selectedRows.map((row) => row.eventKey),
        (done, total) => showMarkProgress_(ss, targetSheetName, done, total, 'Removing moved rows')
      );
    } else if (targetSheetName === CONFIG.nonBillableSheetName) {
      markedCount = appendCalendarRowsToNonBillable_(
        selectedRows,
        managedSheets.nonBillableSheet,
        managedSheets.nonBillableStateSheet,
        (done, total) => showMarkProgress_(ss, targetSheetName, done, total, 'Preparing register rows')
      );
      showMarkProgress_(ss, targetSheetName, selectedRows.length, selectedRows.length, 'Removing moved rows');
      removedCount = removeRegisterRowsByEventKeys_(
        managedSheets.invoicingSheet,
        managedSheets.invoicingStateSheet,
        CONFIG.invoicingHeader,
        CONFIG.invoicingStateHeader,
        selectedRows.map((row) => row.eventKey),
        (done, total) => showMarkProgress_(ss, targetSheetName, done, total, 'Removing moved rows')
      );
    } else {
      throw new Error(`Unsupported mark target: ${targetSheetName}`);
    }

    showMarkProgress_(ss, targetSheetName, selectedRows.length, selectedRows.length, 'Formatting registers');
    applyNumberFormats_(managedSheets.invoicingSheet, CONFIG.invoicingHeader);
    applyNumberFormats_(managedSheets.nonBillableSheet, CONFIG.nonBillableHeader);
    ensureTableRange_(spreadsheetId, managedSheets.invoicingSheet, CONFIG.invoicingTableName, CONFIG.invoicingHeader);
    ensureTableRange_(
      spreadsheetId,
      managedSheets.nonBillableSheet,
      CONFIG.nonBillableTableName,
      CONFIG.nonBillableHeader
    );

    SpreadsheetApp.flush();
    const movedMessage = removedCount > 0 ? ` ${removedCount} row(s) removed from the other register.` : '';
    showToastMessage_(ss, `${markedCount} selected Calendar row(s) marked as ${targetSheetName}.${movedMessage}`, {
      severity: 'info',
    });
  } finally {
    lock.releaseLock();
  }
}

function collectSelectedCalendarRows_(ss, sheet, stateSheet) {
  const rowCount = Math.min(
    Math.max(sheet.getLastRow() - 1, 0),
    Math.max(stateSheet.getLastRow() - 1, 0)
  );
  if (rowCount === 0) {
    return [];
  }

  const selectedRowNumbers = collectSelectedCalendarRowNumbers_(ss, sheet, rowCount);
  if (selectedRowNumbers.length === 0) {
    return [];
  }

  const values = sheet.getRange(2, 1, rowCount, CONFIG.header.length).getValues();
  const stateValues = stateSheet.getRange(2, 1, rowCount, CONFIG.stateHeader.length).getValues();
  const selectedRows = [];

  selectedRowNumbers.forEach((sheetRow) => {
    const index = sheetRow - 2;
    const eventKey = toText_(stateValues[index][0]);
    if (!eventKey || isCompletelyBlankRow_(values[index])) {
      return;
    }

    selectedRows.push({
      eventKey,
      values: values[index].slice(),
    });
  });

  return selectedRows;
}

function collectSelectedCalendarRowNumbers_(ss, sheet, rowCount) {
  const ranges = getSelectedCalendarRanges_(ss, sheet);
  const rowNumbers = new Set();
  const firstDataRow = 2;
  const lastDataRow = rowCount + 1;

  ranges.forEach((range) => {
    const startRow = Math.max(range.getRow(), firstDataRow);
    const endRow = Math.min(range.getLastRow(), lastDataRow);
    for (let row = startRow; row <= endRow; row += 1) {
      if (isCalendarSheetRowVisible_(sheet, row)) {
        rowNumbers.add(row);
      }
    }
  });

  return Array.from(rowNumbers).sort((left, right) => left - right);
}

function isCalendarSheetRowVisible_(sheet, row) {
  if (sheet.isRowHiddenByFilter(row)) {
    return false;
  }
  if (sheet.isRowHiddenByUser(row)) {
    return false;
  }
  return true;
}

function getSelectedCalendarRanges_(ss, sheet) {
  const rangeList = ss.getActiveRangeList ? ss.getActiveRangeList() : null;
  if (rangeList) {
    return rangeList.getRanges().filter((range) => range.getSheet().getSheetId() === sheet.getSheetId());
  }

  const range = ss.getActiveRange();
  if (range && range.getSheet().getSheetId() === sheet.getSheetId()) {
    return [range];
  }

  return [];
}

function showMarkProgress_(ss, targetSheetName, done, total, stepLabel) {
  const normalizedDone = Math.min(Math.max(Number(done) || 0, 0), Math.max(Number(total) || 0, 0));
  const normalizedTotal = Math.max(Number(total) || 0, 0);
  const percentage = normalizedTotal > 0 ? Math.floor((normalizedDone / normalizedTotal) * 100) : 0;
  const stepText = stepLabel ? `${stepLabel} — ` : '';

  writeStatusCellMessage_(
    ss,
    `${stepText}Marking selected Calendar rows as ${targetSheetName}: ${normalizedDone}/${normalizedTotal} (${percentage}%)`
  );
  SpreadsheetApp.flush();
}

function appendCalendarRowsToInvoicing_(calendarRows, invoicingSheet, invoicingStateSheet, progressCallback) {
  const invoiceStore = readInvoicingState_(invoicingSheet, invoicingStateSheet);
  const appendValues = [];
  const appendStateValues = [];

  calendarRows.forEach((row, index) => {
    if (!invoiceStore.byEventKey.has(row.eventKey)) {
      appendValues.push([
        row.values[0],
        row.values[1],
        row.values[2],
        row.values[3],
        row.values[4],
        row.values[5],
        '',
        '',
        '',
        '',
      ]);
      appendStateValues.push([row.eventKey]);
    }

    reportMarkProgress_(progressCallback, index + 1, calendarRows.length);
  });

  appendInvoicingRows_(invoicingSheet, invoicingStateSheet, appendValues, appendStateValues);
  return appendValues.length;
}

function appendCalendarRowsToNonBillable_(calendarRows, nonBillableSheet, nonBillableStateSheet, progressCallback) {
  const nonBillableStore = readNonBillableState_(nonBillableSheet, nonBillableStateSheet);
  const appendValues = [];
  const appendStateValues = [];

  calendarRows.forEach((row, index) => {
    if (!nonBillableStore.byEventKey.has(row.eventKey)) {
      appendValues.push([
        row.values[0],
        row.values[1],
        row.values[2],
        row.values[3],
        row.values[4],
        row.values[5],
        '',
      ]);
      appendStateValues.push([row.eventKey]);
    }

    reportMarkProgress_(progressCallback, index + 1, calendarRows.length);
  });

  appendNonBillableRows_(nonBillableSheet, nonBillableStateSheet, appendValues, appendStateValues);
  return appendValues.length;
}

function reportMarkProgress_(progressCallback, done, total) {
  if (!progressCallback) {
    return;
  }
  if (done === total || done % 10 === 0) {
    progressCallback(done, total);
  }
}

function removeRegisterRowsByEventKeys_(sheet, stateSheet, header, stateHeader, eventKeys, progressCallback) {
  const keys = new Set((eventKeys || []).filter((key) => key));
  if (keys.size === 0) {
    return 0;
  }

  const rowCount = Math.max(stateSheet.getLastRow() - 1, 0);
  if (rowCount === 0) {
    return 0;
  }

  const stateValues = stateSheet.getRange(2, 1, rowCount, stateHeader.length).getValues();
  let removedCount = 0;

  for (let index = stateValues.length - 1; index >= 0; index -= 1) {
    const eventKey = toText_(stateValues[index][0]);
    if (keys.has(eventKey)) {
      sheet.getRange(index + 2, 1, 1, header.length).deleteCells(SpreadsheetApp.Dimension.ROWS);
      stateSheet.getRange(index + 2, 1, 1, stateHeader.length).deleteCells(SpreadsheetApp.Dimension.ROWS);
      removedCount += 1;
    }

    reportMarkProgress_(progressCallback, stateValues.length - index, stateValues.length);
  }

  return removedCount;
}
