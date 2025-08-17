import React, { useState } from 'react';
import { useFamilyTreeContext } from '../hooks/useFamilyTree.ts';
import { UsersIcon } from './ui/Icons.tsx';
import StatsReport from './reports/StatsReport.tsx';
import LifeStoryReport from './reports/LifeStoryReport.tsx';
import RelationshipReport from './reports/RelationshipReport.tsx';
import DescendantsReport from './reports/DescendantsReport.tsx';
import AncestorsReport from './reports/AncestorsReport.tsx';
import EventsReport from './reports/EventsReport.tsx';
import DeathsReport from './reports/DeathsReport.tsx';
import FamilySearchReport from './reports/FamilySearchReport.tsx';

export const ReportsView = () => {
    const { people } = useFamilyTreeContext();
    const [activeTab, setActiveTab] = useState('stats');
    const tabs = [
        { id: 'stats', name: 'Statistics' },
        { id: 'life-story', name: 'Life Story AI' },
        { id: 'relationship', name: 'Relationship Finder' },
        { id: 'descendants', name: 'Descendants' },
        { id: 'ancestors', name: 'Ancestors' },
        { id: 'events', name: 'Life Events' },
        { id: 'deaths', name: 'Deaths' },
        { id: 'family-search', name: 'Family Search' },
    ];
    
    return (
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-xl flex flex-col flex-1">
            <div className="p-6 pb-0">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Reports & Statistics</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Analyze and explore your family data through various reports.</p>
                <div className="mt-4 border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                                } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                            >
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>
            <div className="flex-grow p-6">
                 {people.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center p-8">
                            <h3 className="text-xl font-semibold">Your Family Tree is Empty</h3>
                            <p className="mt-2 text-gray-600 dark:text-gray-400">
                                Add individuals to your tree to generate reports and statistics.
                            </p>
                            <div className="mt-4 inline-block">
                                <UsersIcon className="w-10 h-10 text-gray-400" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'stats' && <StatsReport />}
                        {activeTab === 'life-story' && <LifeStoryReport />}
                        {activeTab === 'relationship' && <RelationshipReport />}
                        {activeTab === 'descendants' && <DescendantsReport />}
                        {activeTab === 'ancestors' && <AncestorsReport />}
                        {activeTab === 'events' && <EventsReport />}
                        {activeTab === 'deaths' && <DeathsReport />}
                        {activeTab === 'family-search' && <FamilySearchReport />}
                    </>
                )}
            </div>
        </div>
    );
};