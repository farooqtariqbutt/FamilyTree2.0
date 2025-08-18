
import React from 'react';
import type { Person } from '../../types.ts';
import Tooltip from './Tooltip.tsx';

interface ParentViewToggleProps {
  person: Person;
  currentView: 'adoptive' | 'biological';
  onToggle: () => void;
}

const ParentViewToggle: React.FC<ParentViewToggleProps> = ({ person, currentView, onToggle }) => {
  if (!person.isAdopted || !person.biologicalParentIds || person.biologicalParentIds.length === 0) {
    return null;
  }

  const isShowingAdoptive = currentView === 'adoptive';
  const buttonText = isShowingAdoptive ? 'B' : 'A';
  const tooltipText = isShowingAdoptive ? 'Show Biological Family' : 'Show Adoptive Family';

  return (
    <div className="absolute -bottom-1 -right-1 z-20 transform translate-x-1/4 translate-y-1/4">
      <Tooltip text={tooltipText}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-200 text-xs font-bold flex items-center justify-center shadow-md hover:scale-110 transition-transform"
          aria-label={tooltipText}
        >
          {buttonText}
        </button>
      </Tooltip>
    </div>
  );
};

export default ParentViewToggle;
