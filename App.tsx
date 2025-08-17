
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Outlet } from 'react-router-dom';
import { useFamilyTree, FamilyTreeContext } from './hooks/useFamilyTree.ts';
import PeopleList from './components/PeopleList.tsx';
import { FamilyTreeView } from './components/FamilyTreeView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import FamilyTimelineView from './components/FamilyTimelineView.tsx';
import MergeTreesView from './components/MergeTreesView.tsx';
import SplitTreeView from './components/SplitTreeView.tsx';
import { MoonIcon, SunIcon, ArrowDownOnSquareIcon, DocumentArrowUpIcon, SaveIcon, ArrowUpTrayIcon, PlusIcon, TrashIcon, MenuIcon, XIcon } from './components/ui/Icons.tsx';
import Modal from './components/ui/Modal.tsx';
import Input from './components/ui/Input.tsx';
import Button from './components/ui/Button.tsx';
import PersonForm from './components/PersonForm.tsx';
import type { Person } from './types.ts';
import Tooltip from './components/ui/Tooltip.tsx';
import FamilyTreePage from './components/FamilyTreePage.tsx';
import WhoAmIView from './components/WhoAmIView.tsx';
import GenerationView from './components/GenerationView.tsx';

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const familyTree = useFamilyTree();
  const [isNewTreeModalOpen, setIsNewTreeModalOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [personToEdit, setPersonToEdit] = useState<Person | undefined>();
  const [newPersonTemplate, setNewPersonTemplate] = useState<Partial<Person> | undefined>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const { isLoading, trees, activeTreeId, createNewTree, switchTree, deleteTree, importGedcom, exportGedcom, backupActiveTree, importBackup } = familyTree;

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(isDark);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        importGedcom(file);
        event.target.value = ''; // Reset file input
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        importBackup(file);
        event.target.value = ''; // Reset file input
    }
  };

  const handleExport = () => {
    if (activeTreeId) {
        exportGedcom(activeTreeId);
    }
  };
  
  const handleCreateTree = () => {
      if (newTreeName.trim()) {
          createNewTree(newTreeName.trim());
          setNewTreeName('');
          setIsNewTreeModalOpen(false);
      } else {
          alert("Please enter a name for the tree.");
      }
  };
  
  const handleDeleteTree = () => {
      if(activeTreeId){
        deleteTree(activeTreeId);
        setIsDeleteModalOpen(false);
      }
  };

  const openPersonForm = (person?: Person, template?: Partial<Person>) => {
    setPersonToEdit(person);
    setNewPersonTemplate(template);
    setIsFormModalOpen(true);
  };

  const closePersonForm = () => {
    setIsFormModalOpen(false);
    setPersonToEdit(undefined);
    setNewPersonTemplate(undefined);
  };
  
  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
            <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">Loading Family Data...</p>
            </div>
        </div>
    );
  }

  const DesktopNav = () => (
    <>
      {/* Desktop Tree Selector */}
      <div className="hidden lg:flex items-center space-x-2 border-l border-gray-200 dark:border-gray-700 pl-4">
         <select 
              id="tree-select" 
              value={activeTreeId || ''} 
              onChange={e => switchTree(e.target.value)} 
              className="p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed w-48"
              disabled={!activeTreeId}
          >
              {Object.keys(trees).length > 0 ? (
                  Object.keys(trees).map(treeId => <option key={treeId} value={treeId}>{trees[treeId].name}</option>)
              ) : (
                  <option value="">- No Active Tree -</option>
              )}
          </select>
          <Tooltip text="Add New Tree">
              <button onClick={() => setIsNewTreeModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
                  <PlusIcon />
              </button>
          </Tooltip>
          <Tooltip text="Save Backup (.json)">
              <button onClick={backupActiveTree} disabled={!activeTreeId} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  <SaveIcon />
              </button>
          </Tooltip>
          <Tooltip text="Restore from Backup (.json)">
              <label htmlFor="backup-import" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
                  <ArrowUpTrayIcon />
                  <input id="backup-import" type="file" accept=".json" className="hidden" onChange={handleImportBackup}/>
              </label>
          </Tooltip>
          <Tooltip text="Delete Active Tree">
              <button 
                  onClick={() => setIsDeleteModalOpen(true)} 
                  disabled={!activeTreeId} 
                  className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <TrashIcon />
              </button>
          </Tooltip>
      </div>

      <div className="border-l border-gray-200 dark:border-gray-700 h-6 mx-2 hidden lg:block"></div>

      {/* Middle: Navigation */}
      <nav className="flex items-center space-x-2">
          <NavItem to="/">All Individuals</NavItem>
          <NavItem to="/tree">Family Tree</NavItem>
          <NavItem to="/timeline">Family Timeline</NavItem>
          <NavItem to="/reports">Reports & Stats</NavItem>
          <NavItem to="/merge">Merge Trees</NavItem>
          <NavItem to="/split">Split Tree</NavItem>
      </nav>

      <div className="border-l border-gray-200 dark:border-gray-700 h-6 mx-2"></div>

      {/* Right side: Actions */}
      <div className="flex items-center space-x-2">
           <Tooltip text="Import GEDCOM (.ged)">
              <label htmlFor="gedcom-import" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
                  <DocumentArrowUpIcon />
                  <input id="gedcom-import" type="file" accept=".ged" className="hidden" onChange={handleImport}/>
              </label>
          </Tooltip>
          <Tooltip text="Export GEDCOM (.ged)">
              <button onClick={handleExport} disabled={!activeTreeId} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  <ArrowDownOnSquareIcon />
              </button>
          </Tooltip>
          <div className="border-l border-gray-200 dark:border-gray-700 h-6 mx-2"></div>
          <Tooltip text={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <button onClick={toggleDarkMode} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                  {isDarkMode ? <SunIcon /> : <MoonIcon />}
              </button>
          </Tooltip>
      </div>
    </>
  );

  return (
    <FamilyTreeContext.Provider value={familyTree}>
        <HashRouter>
            <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-800 font-sans overflow-hidden">
                {/* Header */}
                <header className="bg-white dark:bg-gray-900 shadow-md p-3 flex items-center justify-between z-20 flex-shrink-0">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Digital Family Tree</h1>
                    </div>
                    
                    <div className="hidden md:flex items-center space-x-4">
                      <DesktopNav />
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button onClick={() => setIsMenuOpen(true)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <MenuIcon />
                        </button>
                    </div>
                </header>

                {/* Mobile Menu Panel */}
                <div className={`fixed inset-0 z-30 transform transition-transform ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'} md:hidden`} role="dialog" aria-modal="true">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsMenuOpen(false)}></div>
                    <div className="relative bg-white dark:bg-gray-800 w-80 h-full ml-auto p-6 flex flex-col space-y-6 overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-lg">Menu</h2>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 -mr-2">
                                <XIcon />
                            </button>
                        </div>
                        
                        <div className="flex flex-col space-y-4 border-b dark:border-gray-700 pb-4">
                          <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tree Management</h3>
                          <select 
                              id="tree-select-mobile" 
                              value={activeTreeId || ''} 
                              onChange={e => switchTree(e.target.value)} 
                              className="p-2 border rounded bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:opacity-50 w-full"
                              disabled={!activeTreeId}
                          >
                              {Object.keys(trees).length > 0 ? (
                                  Object.keys(trees).map(treeId => <option key={treeId} value={treeId}>{trees[treeId].name}</option>)
                              ) : (
                                  <option value="">- No Active Tree -</option>
                              )}
                          </select>
                           <div className="grid grid-cols-2 gap-2">
                              <Button variant="secondary" onClick={() => { setIsNewTreeModalOpen(true); setIsMenuOpen(false); }}>New Tree</Button>
                              <Button variant="secondary" onClick={() => { backupActiveTree(); setIsMenuOpen(false); }} disabled={!activeTreeId}>Save Backup</Button>
                              <label htmlFor="backup-import-mobile" className="w-full">
                                  <Button variant="secondary" as="span" className="w-full">Restore Backup</Button>
                                  <input id="backup-import-mobile" type="file" accept=".json" className="hidden" onChange={handleImportBackup}/>
                              </label>
                              <Button variant="danger" onClick={() => { setIsDeleteModalOpen(true); setIsMenuOpen(false); }} disabled={!activeTreeId}>Delete Tree</Button>
                          </div>
                        </div>

                        <nav className="flex flex-col space-y-2">
                           <NavLink to="/" onClick={() => setIsMenuOpen(false)} className={({isActive}) => `px-4 py-2 rounded-md font-medium ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>All Individuals</NavLink>
                           <NavLink to="/tree" onClick={() => setIsMenuOpen(false)} className={({isActive}) => `px-4 py-2 rounded-md font-medium ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>Family Tree</NavLink>
                           <NavLink to="/timeline" onClick={() => setIsMenuOpen(false)} className={({isActive}) => `px-4 py-2 rounded-md font-medium ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>Family Timeline</NavLink>
                           <NavLink to="/reports" onClick={() => setIsMenuOpen(false)} className={({isActive}) => `px-4 py-2 rounded-md font-medium ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>Reports & Stats</NavLink>
                           <NavLink to="/merge" onClick={() => setIsMenuOpen(false)} className={({isActive}) => `px-4 py-2 rounded-md font-medium ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>Merge Trees</NavLink>
                           <NavLink to="/split" onClick={() => setIsMenuOpen(false)} className={({isActive}) => `px-4 py-2 rounded-md font-medium ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}>Split Tree</NavLink>
                        </nav>
                        
                        <div className="flex flex-col space-y-2 border-t dark:border-gray-700 pt-4">
                           <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider">Import / Export</h3>
                           <label htmlFor="gedcom-import-mobile" className="w-full">
                                <Button as="span" variant="secondary" className="w-full"><DocumentArrowUpIcon/><span className="ml-2">Import GEDCOM</span></Button>
                                <input id="gedcom-import-mobile" type="file" accept=".ged" className="hidden" onChange={handleImport}/>
                            </label>
                           <Button variant="secondary" onClick={handleExport} disabled={!activeTreeId}><ArrowDownOnSquareIcon/><span className="ml-2">Export GEDCOM</span></Button>
                        </div>
                        
                        <div className="mt-auto border-t dark:border-gray-700 pt-4">
                           <Button variant="secondary" onClick={toggleDarkMode} className="w-full">{isDarkMode ? <SunIcon /> : <MoonIcon />}<span className="ml-2">{isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span></Button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
                    <Routes>
                        <Route path="/" element={<PeopleList openPersonForm={openPersonForm} />} />
                        <Route path="/tree" element={<FamilyTreePage />}>
                            <Route index element={<FamilyTreeView openPersonForm={openPersonForm} />} />
                            <Route path="who-am-i" element={<WhoAmIView />} />
                            <Route path="generation" element={<GenerationView />} />
                        </Route>
                        <Route path="/timeline" element={<FamilyTimelineView />} />
                        <Route path="/reports" element={<ReportsView />} />
                        <Route path="/merge" element={<MergeTreesView />} />
                        <Route path="/split" element={<SplitTreeView />} />
                    </Routes>
                </main>
            </div>
        </HashRouter>
        
        {/* Modals */}
        <Modal isOpen={isNewTreeModalOpen} onClose={() => setIsNewTreeModalOpen(false)} title="Create New Family Tree">
            <div className="space-y-4">
                <Input
                    label="Tree Name"
                    id="new-tree-name"
                    value={newTreeName}
                    onChange={(e) => setNewTreeName(e.target.value)}
                    placeholder="e.g., 'My Paternal Lineage'"
                    autoFocus
                />
                <div className="flex justify-end space-x-2">
                    <Button variant="secondary" onClick={() => setIsNewTreeModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTree}>Create Tree</Button>
                </div>
            </div>
        </Modal>

        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
            <div className="space-y-4">
                <p>Are you sure you want to delete the tree "{activeTreeId && trees[activeTreeId]?.name}"? This action cannot be undone.</p>
                <div className="flex justify-end space-x-2">
                    <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                    <Button variant="danger" onClick={handleDeleteTree}>Delete Tree</Button>
                </div>
            </div>
        </Modal>

        <PersonForm 
            isOpen={isFormModalOpen}
            onClose={closePersonForm}
            personToEdit={personToEdit}
            newPersonTemplate={newPersonTemplate}
        />
    </FamilyTreeContext.Provider>
  );
};

interface NavItemProps {
    to: string;
    children: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ to, children }) => {
  const location = useLocation();
  const isActive = (to === '/') ? location.pathname === to : location.pathname.startsWith(to);
  const activeClass = "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300";
  const inactiveClass = "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700";

  return (
    <NavLink to={to} className={`px-4 py-2 rounded-md text-sm font-medium ${isActive ? activeClass : inactiveClass}`}>
      <span>{children}</span>
    </NavLink>
  );
};

export default App;
