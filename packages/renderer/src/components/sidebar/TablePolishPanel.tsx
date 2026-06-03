import { useState } from 'react';
import { Button, Divider, Input, Table, message } from 'antd';
import {
  InsertRowBelowOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse, type TableData } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { insertDocumentHtml } from '../../services/documentEngineCommands';

export function TablePolishPanel() {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [expectedCols, setExpectedCols] = useState('');

  const handleCSVUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const csvData = String(reader.result || '');
        setProcessing(true);
        try {
          const response = await ipcClient.invoke<IPCResponse<TableData>>(IPC_CHANNELS.AI_PROCESS_TABLE, {
            csvData,
            headers: csvData.split('\n')[0]?.split(',').map((item: string) => item.trim()) || [],
            expectedColumns: expectedCols ? expectedCols.split(',').map((item) => item.trim()) : undefined,
            aiConfig: {
              provider: 'anthropic',
              model: 'claude-sonnet-4-6',
              temperature: 0.3,
              maxTokens: 4096,
            },
          });

          if (response.success && response.data) {
            setTableData(response.data);
            message.success('表格数据处理完成');
          }
        } catch {
          message.error('表格处理失败');
        } finally {
          setProcessing(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleInsertToEditor = async () => {
    if (!tableData) {
      return;
    }

    let tableHTML = '<table class="three-line-table" style="border-collapse:collapse;width:100%;">';
    tableHTML += '<thead><tr>';
    tableData.headers.forEach((header) => {
      tableHTML += `<th style="border-top:1.5pt solid #000;border-bottom:0.75pt solid #000;padding:4pt 6pt;text-align:center;font-size:10.5pt;">${header}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    tableData.rows.forEach((row) => {
      tableHTML += '<tr>';
      row.forEach((cell) => {
        tableHTML += `<td style="padding:4pt 6pt;text-align:center;font-size:10.5pt;">${cell}</td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += `<tr style="border-bottom:1.5pt solid #000;"><td colspan="${tableData.headers.length}" style="padding:0;"></td></tr>`;
    tableHTML += '</tbody></table>';

    const applied = await insertDocumentHtml(tableHTML);
    if (!applied) {
      message.error('当前文档无法插入表格');
      return;
    }

    message.success('三线表已插入编辑区');
  };

  const columns =
    tableData?.headers.map((header) => ({
      title: header,
      dataIndex: header,
      key: header,
    })) || [];

  const dataSource =
    tableData?.rows.map((row, index) => {
      const rowData: Record<string, string> = { key: String(index) };
      tableData.headers.forEach((header, columnIndex) => {
        rowData[header] = row[columnIndex] || '';
      });
      return rowData;
    }) || [];

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <UploadOutlined /> 上传表格数据
        </label>
        <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          支持 CSV、Excel 格式，处理后可直接插入为报告常用三线表。
        </p>
        <Button
          icon={<UploadOutlined />}
          onClick={handleCSVUpload}
          size="small"
          block
          style={{ marginTop: 6 }}
          loading={processing}
        >
          上传 CSV / Excel 文件
        </Button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>指定列名（可选，逗号分隔）</label>
        <Input
          size="small"
          value={expectedCols}
          onChange={(event) => setExpectedCols(event.target.value)}
          placeholder="例如：指标名称, 单位, 数值, 备注"
        />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {tableData ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              <TableOutlined /> 预览表格
            </label>
            <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
              {tableData.headers.length} 列 x {tableData.rows.length} 行
            </span>
          </div>
          <div
            style={{
              maxHeight: 300,
              overflow: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
            }}
          >
            <Table
              columns={columns}
              dataSource={dataSource}
              size="small"
              pagination={false}
              className="three-line-preview"
              style={{ fontSize: 11 }}
            />
          </div>
          <Button
            type="primary"
            icon={<InsertRowBelowOutlined />}
            onClick={() => void handleInsertToEditor()}
            block
            size="small"
            style={{ marginTop: 8 }}
          >
            插入编辑区
          </Button>
        </>
      ) : null}
    </div>
  );
}
