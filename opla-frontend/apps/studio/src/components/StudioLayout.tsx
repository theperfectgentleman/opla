import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import ThemeToggle from './ThemeToggle';
import {
    Layout,
    Folder,
    Users,
    Settings,
    Search,
    Bell,
    Target,
    BarChart3,
    FileBarChart2,
    ChevronDown,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';

type StudioNavKey =
    | 'projects'
    | 'forms'
    | 'members'
    | 'audience'
    | 'analysis'
    | 'reports'
    | 'settings';

type NavCounts = {
    projects?: number;
    forms?: number;
    members?: number;
};

type StudioLayoutProps = {
    activeNav: StudioNavKey;
    onSelectNav: (key: StudioNavKey) => void;
    children: React.ReactNode;
    counts?: NavCounts;
    contentClassName?: string;
    alignRightRail?: boolean;
};

const navItems: Array<{ key: StudioNavKey; label: string; icon: React.ReactNode; countKey?: keyof NavCounts }> = [
    { key: 'projects', label: 'Projects', icon: <Folder className="w-5 h-5" />, countKey: 'projects' },
    { key: 'forms', label: 'All Forms', icon: <Layout className="w-5 h-5" />, countKey: 'forms' },
    { key: 'members', label: 'Teams', icon: <Users className="w-5 h-5" />, countKey: 'members' },
    { key: 'audience', label: 'Audience', icon: <Target className="w-5 h-5" /> },
    { key: 'analysis', label: 'Analysis', icon: <BarChart3 className="w-5 h-5" /> },
    { key: 'reports', label: 'Reports', icon: <FileBarChart2 className="w-5 h-5" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const StudioLayout: React.FC<StudioLayoutProps> = ({
    activeNav,
    onSelectNav,
    children,
    counts,
    contentClassName = 'flex-1 overflow-y-auto p-10',
    alignRightRail = false,
}) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { currentOrg, currentProject, organizations, setCurrentOrg, setCurrentProject } = useOrg();

    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const handleOrganizationSwitch = (orgId: string) => {
        const org = organizations.find(o => o.id === orgId);
        if (!org || currentOrg?.id === org.id) return;

        // Persist selection immediately so the next boot loads the chosen org.
        localStorage.setItem('current_org_id', org.id);
        setCurrentOrg(org);
        setCurrentProject(null);
        setIsProfileMenuOpen(false);

        // Force a full app re-initialization into the selected organization scope.
        window.location.assign('/dashboard');
    };

    return (
        <div className="flex h-screen bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] overflow-hidden">
            <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-[hsl(var(--surface))] border-r border-[hsl(var(--border))] flex flex-col transition-all duration-200`}>
                <div className="p-6">
                    <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-8`}>
                        <div className={`flex items-center ${isSidebarCollapsed ? '' : 'space-x-3'}`}>
                            <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-black/10">
                                O
                            </div>
                            {!isSidebarCollapsed && <span className="font-bold text-xl tracking-tight">Opla Studio</span>}
                        </div>
                        {!isSidebarCollapsed && (
                            <button
                                onClick={() => setIsSidebarCollapsed(true)}
                                aria-label="Collapse sidebar"
                                className="p-1.5 rounded-lg text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                            >
                                <PanelLeftClose className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {isSidebarCollapsed && (
                        <div className="flex justify-center mb-6">
                            <button
                                onClick={() => setIsSidebarCollapsed(false)}
                                aria-label="Expand sidebar"
                                className="p-1.5 rounded-lg text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] transition-all"
                            >
                                <PanelLeftOpen className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <nav className="space-y-1">
                        {!isSidebarCollapsed && currentOrg && (
                            <div className="mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--text-tertiary))]">Workspace</p>
                                <p className="mt-2 truncate text-sm font-semibold text-[hsl(var(--text-primary))]">{currentOrg.name}</p>
                                <p className="truncate text-xs text-[hsl(var(--text-secondary))]">
                                    {currentProject ? currentProject.name : 'Organization overview'}
                                </p>
                            </div>
                        )}
                        {navItems.map(item => {
                            const isActive = activeNav === item.key;
                            const count = item.countKey ? (counts?.[item.countKey] ?? 0) : 0;

                            return (
                                <button
                                    key={item.key}
                                    onClick={() => onSelectNav(item.key)}
                                    title={item.label}
                                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : item.countKey ? 'justify-between px-4' : 'space-x-3 px-4'} py-3 rounded-xl transition-all ${isActive ? 'bg-[hsl(var(--primary))] text-white shadow-lg shadow-black/10' : 'hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'}`}
                                >
                                    <div className={`flex items-center ${isSidebarCollapsed ? '' : 'space-x-3'}`}>
                                        {item.icon}
                                        {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
                                    </div>
                                    {!isSidebarCollapsed && item.countKey && count > 0 && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] border border-[hsl(var(--border))]'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className={`relative z-40 h-16 border-b border-[hsl(var(--border))] flex items-center justify-between bg-[hsl(var(--surface))]/70 backdrop-blur-md gap-3 ${alignRightRail ? 'pl-4 md:pl-8 pr-0' : 'px-4 md:px-8'}`}>
                    <div className="flex items-center bg-[hsl(var(--surface-elevated))] rounded-xl px-4 py-2 w-72 sm:w-80 md:w-96 lg:w-[26rem] border border-[hsl(var(--border))] focus-within:ring-2 focus-within:ring-[hsl(var(--primary))]/50 transition-all shrink-0">
                        <Search className="w-4 h-4 text-[hsl(var(--text-tertiary))] mr-2" />
                        <input className="bg-transparent border-none w-full text-sm text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-tertiary))] focus:outline-none" placeholder="Search forms, projects..." />
                    </div>
                    <div className="ml-auto flex items-center space-x-3 md:space-x-4">
                        <button className="w-9 h-9 rounded-xl inline-flex items-center justify-center text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-[hsl(var(--primary))] rounded-full border-2 border-[hsl(var(--surface))]"></span>
                        </button>

                        <ThemeToggle iconOnly className="w-9 h-9 rounded-xl inline-flex items-center justify-center" />

                        <div className={`${alignRightRail ? 'h-full w-80 border-l border-[hsl(var(--border))] px-4 md:px-6 flex items-center justify-end' : 'pl-3 md:pl-4 border-l border-[hsl(var(--border))]'} `}>
                            <div ref={profileMenuRef} className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen(prev => !prev)}
                                className={`flex items-center justify-end space-x-2 min-w-[190px] md:min-w-[220px] ${alignRightRail ? 'pl-2 pr-1 md:pr-2' : 'pr-1 md:pr-2'}`}
                            >
                                <div className="text-right hidden md:block">
                                    <p className="text-sm font-semibold">{user?.full_name}</p>
                                    <p className="text-xs text-[hsl(var(--text-tertiary))]">Account</p>
                                </div>
                                <div className="w-10 h-10 bg-gradient-to-br from-[hsl(var(--accent-1))] to-[hsl(var(--accent-2))] rounded-xl shadow-lg"></div>
                                <ChevronDown className={`w-4 h-4 text-[hsl(var(--text-tertiary))] transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isProfileMenuOpen && (
                                <div className="absolute right-0 mt-3 w-[22rem] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-xl p-4 z-[60]">
                                    <div className="mb-4 pb-4 border-b border-[hsl(var(--border))]">
                                        <p className="text-sm font-semibold">{user?.full_name}</p>
                                        <p className="text-xs text-[hsl(var(--text-tertiary))]">{user?.email}</p>
                                    </div>

                                    <div className="mb-4">
                                        <label className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-widest mb-2 block">
                                            Organization
                                        </label>
                                        <select
                                            value={currentOrg?.id ?? ''}
                                            onChange={(e) => handleOrganizationSwitch(e.target.value)}
                                            className="w-full bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[hsl(var(--primary))] transition-all cursor-pointer"
                                        >
                                            {organizations.map(org => (
                                                <option key={org.id} value={org.id}>{org.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setIsProfileMenuOpen(false);
                                            navigate('/welcome');
                                        }}
                                        className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] font-semibold transition-all mb-3"
                                    >
                                        + Create Organization
                                    </button>

                                    <button
                                        onClick={() => { logout(); navigate('/login'); }}
                                        className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--error))] transition-all"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span className="font-medium">Logout</span>
                                    </button>
                                </div>
                            )}
                            </div>
                            </div>
                        </div>
                </header>

                <div className={contentClassName}>{children}</div>
            </main>
        </div>
    );
};

export default StudioLayout;
