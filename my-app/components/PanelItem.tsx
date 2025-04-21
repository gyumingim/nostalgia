// components/PanelItem.tsx
import React from 'react';

interface PanelItemProps {
  /** 라벨 텍스트 (선택 사항) */
  label?: string;
  /** 자식으로 전달할 인풋이나 버튼 등의 컨트롤 */
  children: React.ReactNode;
}

const PanelItem: React.FC<PanelItemProps> = ({ label, children }) => (
  <div className="flex items-center justify-center gap-2 border-r border-gray-900">
    {label ? (
      <label className="flex items-center gap-1 whitespace-nowrap">
        <span >{label}</span>
        {children}
      </label>
    ) : (
      children
    )}
  </div>
);

export default PanelItem;
