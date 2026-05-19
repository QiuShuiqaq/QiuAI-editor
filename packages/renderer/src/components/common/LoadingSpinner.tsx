import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingSpinnerProps {
  tip?: string;
}

export function LoadingSpinner({ tip = '加载中...' }: LoadingSpinnerProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    }}>
      <Spin indicator={<LoadingOutlined spin />} tip={tip}>
        <div style={{ padding: 50 }} />
      </Spin>
    </div>
  );
}
