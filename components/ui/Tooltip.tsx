import React, { Children, cloneElement } from 'react';

interface TooltipProps {
    text: string;
    children: React.ReactElement;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const child = Children.only(children);

  // Add aria-label to the child element for better accessibility
  const trigger = cloneElement(child, Object.assign({}, child.props, {
      'aria-label': text,
      "aria-labelledby": undefined,
  }));

  return (
    <div className="relative group flex items-center">
      {trigger}
      <div 
        id="tooltip"
        className="absolute top-full mt-2 w-max bg-gray-700 text-white text-xs rounded-md py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none transform -translate-x-1/2 left-1/2 z-20"
        role="tooltip"
      >
        {text}
      </div>
    </div>
  );
};

export default Tooltip;
