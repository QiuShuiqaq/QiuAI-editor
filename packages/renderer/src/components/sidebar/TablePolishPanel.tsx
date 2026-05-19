import { useState } from 'react';
import { Button, Input, Space, Divider, Upload, message, Table } from 'antd';
import {
  UploadOutlined,
  RobotOutlined,
  TableOutlined,
  InsertRowBelowOutlined,
} from '@ant-design/icons';
import { IPC_CHANNELS, type IPCResponse, type TableData } from '@qiuai/shared';
import { ipcClient } from '../../services/ipcClient';
import { useEditorStore } from '../../stores/useEditorStore';

export function TablePolishPanel() {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [expectedCols, setExpectedCols] = useState('');
  const editor = useEditorStore((s) => s.editor);

  const handleCSVUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const csvData = ev.target?.result as string;
        setProcessing(true);
        try {
          const response = await ipcClient.invoke<IPCResponse<TableData>>(
            IPC_CHANNELS.AI_PROCESS_TABLE,
            {
              csvData,
              headers: csvData.split('\n')[0]?.split(',').map((h: string) => h.trim()) || [],
              expectedColumns: expectedCols ? expectedCols.split(',').map(c => c.trim()) : undefined,
              aiConfig: { provider: 'anthropic', model: 'claude-sonnet-4-6', temperature: 0.3, maxTokens: 4096 },
            }
          );

          if (response.success && response.data) {
            setTableData(response.data);
            message.success('表格数据处理完成');
          }
        } catch (e) {
          message.error('表格处理失败');
        } finally {
          setProcessing(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleInsertToEditor = () => {
    if (!tableData || !editor) return;

    const colWidth = Math.floor(100 / tableData.headers.length);

    let tableHTML = '<table class="three-line-table" style="border-collapse:collapse;width:100%;">';
    tableHTML += '<thead><tr>';
    tableData.headers.forEach(h => {
      tableHTML += `<th style="border-top:1.5pt solid #000;border-bottom:0.75pt solid #000;padding:4pt 6pt;text-align:center;font-size:10.5pt;">${h}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    tableData.rows.forEach(row => {
      tableHTML += '<tr>';
      row.forEach(cell => {
        tableHTML += `<td style="padding:4pt 6pt;text-align:center;font-size:10.5pt;">${cell}</td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += `<tr style="border-bottom:1.5pt solid #000;"><td colspan="${tableData.headers.length}" style="padding:0;"></td></tr>`;
    tableHTML += '</tbody></table>';

    editor.commands.insertContent(tableHTML);
    message.success('三线格表格已插入编辑区');
  };

  const columns = tableData?.headers.map((h) => ({
    title: h,
    dataIndex: h,
    key: h,
  })) || [];

  const dataSource = tableData?.rows.map((row, i) => {
    const obj: Record<string, string> = { key: String(i) };
    tableData.headers.forEach((h, j) => {
      obj[h] = row[j] || '';
    });
    return obj;
  }) || [];

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 500 }}>
          <UploadOutlined /> 上传表格数据
        </label>
        <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
          支持CSV、Excel格式。表格将自动转换为学术三线格格式。
        </p>
        <Button
          icon={<UploadOutlined />}
          onClick={handleCSVUpload}
          size="small"
          block
          style={{ marginTop: 6 }}
          loading={processing}
        >
          上传CSV/Excel文件
        </Button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
          指定列名（可选，逗号分隔）
        </label>
        <Input
          size="small"
          value={expectedCols}
          onChange={(e) => setExpectedCols(e.target.value)}
          placeholder="如：指标名称,单位,数值,备注"
        />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {tableData && (
        <>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 500 }}>
              <TableOutlined /> 预览表格
            </label>
            <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
              {tableData.headers.length}列 × {tableData.rows.length}行
            </span>
          </div>
          <div style={{
            maxHeight: 300,
            overflow: 'auto',
            border: '1px solid #d9d9d9',
            borderRadius: 4,
          }}>
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
            onClick={handleInsertToEditor}
            block
            size="small"
            style={{ marginTop: 8 }}
          >
            插入到编辑区
          </Button>
        </>
      )}
    </div>
  );
}
