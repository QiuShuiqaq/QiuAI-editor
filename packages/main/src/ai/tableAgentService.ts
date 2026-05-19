import type { TableProcessRequest, TableData } from '@qiuai/shared';

class TableAgentService {
  async process(request: TableProcessRequest): Promise<TableData> {
    const { csvData, headers, expectedColumns } = request;

    // Parse CSV data
    const lines = csvData.trim().split('\n');
    const parsedHeaders = lines[0]?.split(',').map(h => h.trim()) || [];
    const rows = lines.slice(1).map(line =>
      line.split(',').map(cell => cell.trim())
    );

    // If expected columns specified, reorder/filter
    let finalHeaders = parsedHeaders;
    let finalRows = rows;

    if (expectedColumns && expectedColumns.length > 0) {
      finalHeaders = expectedColumns;
      const headerIndex = parsedHeaders.reduce(
        (acc, h, i) => { acc[h] = i; return acc; },
        {} as Record<string, number>
      );

      finalRows = rows.map(row =>
        expectedColumns.map(col => {
          const idx = headerIndex[col];
          return idx !== undefined && idx < row.length ? row[idx] : '';
        })
      );
    }

    return { headers: finalHeaders, rows: finalRows };
  }
}

export const tableAgentService = new TableAgentService();
