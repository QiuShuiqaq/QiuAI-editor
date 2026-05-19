/** TemplateDialog — preset framework templates for common document types */
import { useState } from 'react';
import { Modal, Card, Radio, Button, Space, message } from 'antd';
import { FileTextOutlined, ExperimentOutlined, FundOutlined, RocketOutlined } from '@ant-design/icons';
import { useFrameworkStore } from '../../stores/useFrameworkStore';
import type { FrameworkNode } from '@qiuai/shared';

const TEMPLATES: Record<string, { name: string; icon: React.ReactNode; desc: string; nodes: FrameworkNode[] }> = {
  tech: {
    name: '科技项目申报书', icon: <RocketOutlined />, desc: '适用于科技厅/科技局项目申报',
    nodes: [
      { id:'1',title:'一、项目概述',level:1,order:1,children:[
        { id:'1a',title:'（一）项目背景与意义',level:2,order:1,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
        { id:'1b',title:'（二）国内外研究现状',level:2,order:2,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
        { id:'1c',title:'（三）项目目标与任务',level:2,order:3,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'2',title:'二、技术方案',level:1,order:2,children:[
        { id:'2a',title:'（一）技术路线',level:2,order:1,children:[],needsImage:true,needsTable:false,dataKeywords:[] },
        { id:'2b',title:'（二）关键技术与创新点',level:2,order:2,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
        { id:'2c',title:'（三）技术指标',level:2,order:3,children:[],needsImage:false,needsTable:true,dataKeywords:['指标','参数'] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'3',title:'三、实施计划与进度',level:1,order:3,children:[
        { id:'3a',title:'（一）实施计划',level:2,order:1,children:[],needsImage:false,needsTable:true,dataKeywords:[] },
        { id:'3b',title:'（二）项目进度安排',level:2,order:2,children:[],needsImage:false,needsTable:true,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'4',title:'四、经费预算',level:1,order:4,children:[],needsImage:false,needsTable:true,dataKeywords:['经费','万元'] },
      { id:'5',title:'五、预期成果与效益',level:1,order:5,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
    ],
  },
  nsfc: {
    name: '自然科学基金申报书', icon: <ExperimentOutlined />, desc: '适用于国家/省自然科学基金',
    nodes: [
      { id:'1',title:'一、立项依据与研究内容',level:1,order:1,children:[
        { id:'1a',title:'（一）立项依据',level:2,order:1,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
        { id:'1b',title:'（二）研究内容、目标与关键科学问题',level:2,order:2,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'2',title:'二、研究方案与可行性分析',level:1,order:2,children:[
        { id:'2a',title:'（一）研究方法与技术路线',level:2,order:1,children:[],needsImage:true,needsTable:false,dataKeywords:[] },
        { id:'2b',title:'（二）可行性分析',level:2,order:2,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'3',title:'三、研究基础与条件',level:1,order:3,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'4',title:'四、经费预算',level:1,order:4,children:[],needsImage:false,needsTable:true,dataKeywords:['经费','万元'] },
    ],
  },
  social: {
    name: '社科基金申报书', icon: <FundOutlined />, desc: '适用于国家/省社科基金项目',
    nodes: [
      { id:'1',title:'一、选题依据',level:1,order:1,children:[
        { id:'1a',title:'（一）国内外相关研究现状',level:2,order:1,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
        { id:'1b',title:'（二）选题价值与意义',level:2,order:2,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'2',title:'二、研究内容与思路',level:1,order:2,children:[
        { id:'2a',title:'（一）研究对象与内容',level:2,order:1,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
        { id:'2b',title:'（二）研究思路与方法',level:2,order:2,children:[],needsImage:true,needsTable:false,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'3',title:'三、创新点与预期成果',level:1,order:3,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'4',title:'四、研究基础',level:1,order:4,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
    ],
  },
  product: {
    name: '新产品研发申报书', icon: <FileTextOutlined />, desc: '适用于企业新产品/新工艺研发项目',
    nodes: [
      { id:'1',title:'一、项目背景',level:1,order:1,children:[
        { id:'1a',title:'（一）市场需求分析',level:2,order:1,children:[],needsImage:false,needsTable:true,dataKeywords:[] },
        { id:'1b',title:'（二）技术现状与差距',level:2,order:2,children:[],needsImage:false,needsTable:false,dataKeywords:[] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'2',title:'二、研发方案',level:1,order:2,children:[
        { id:'2a',title:'（一）产品设计',level:2,order:1,children:[],needsImage:true,needsTable:false,dataKeywords:[] },
        { id:'2b',title:'（二）工艺流程',level:2,order:2,children:[],needsImage:true,needsTable:false,dataKeywords:[] },
        { id:'2c',title:'（三）技术指标',level:2,order:3,children:[],needsImage:false,needsTable:true,dataKeywords:['指标','参数'] },
      ],needsImage:false,needsTable:false,dataKeywords:[] },
      { id:'3',title:'三、实施计划与投资预算',level:1,order:3,children:[],needsImage:false,needsTable:true,dataKeywords:['经费','万元'] },
      { id:'4',title:'四、预期经济效益',level:1,order:4,children:[],needsImage:false,needsTable:true,dataKeywords:[] },
    ],
  },
};

interface Props { open: boolean; onClose: () => void; }

export function TemplateDialog({ open, onClose }: Props) {
  const [selected, setSelected] = useState('tech');
  const setNodes = useFrameworkStore((s) => s.setNodes);

  const apply = () => {
    const tpl = TEMPLATES[selected];
    // Deep clone nodes with fresh IDs
    const clone = (ns: FrameworkNode[]): FrameworkNode[] => ns.map(n => ({
      ...n, id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      children: clone(n.children),
    }));
    setNodes(clone(tpl.nodes));
    message.success(`已套用「${tpl.name}」模板`);
    onClose();
  };

  return (
    <Modal title="选择模板" open={open} onCancel={onClose} footer={null} width={500}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        {Object.entries(TEMPLATES).map(([key,tpl]) => (
          <Card size="small" hoverable key={key}
            style={{border:selected===key?'2px solid #1677ff':'1px solid #d9d9d9'}}
            onClick={()=>setSelected(key)}>
            <Space><span style={{fontSize:18}}>{tpl.icon}</span><strong style={{fontSize:13}}>{tpl.name}</strong></Space>
            <div style={{fontSize:11,color:'#999',marginTop:4}}>{tpl.desc}</div>
          </Card>
        ))}
      </div>
      <Button type="primary" block onClick={apply}>套用模板</Button>
    </Modal>
  );
}
