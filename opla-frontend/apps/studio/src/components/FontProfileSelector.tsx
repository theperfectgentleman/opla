import React, { useState } from 'react';

export type FontProfile = 'modern' | 'warm' | 'editorial' | 'developer';

export const fontProfiles = [
    {
        id: 'modern' as FontProfile,
        name: 'Sleek Geometric (Default)',
        headingFont: 'Outfit',
        bodyFont: 'Plus Jakarta Sans',
        description: 'Clean circular headings with soft geometric body copy. Sleek and professional.',
        previewText: 'Aa',
    },
    {
        id: 'warm' as FontProfile,
        name: 'Warm Minimalist',
        headingFont: 'Plus Jakarta Sans',
        bodyFont: 'Inter',
        description: 'Warm, clear headings paired with highly readable, crisp body copy.',
        previewText: 'Aa',
    },
    {
        id: 'editorial' as FontProfile,
        name: 'Tech Editorial',
        headingFont: 'Lora',
        bodyFont: 'Inter',
        description: 'High-end literary headings with compact and structured body text.',
        previewText: 'Aa',
    },
    {
        id: 'developer' as FontProfile,
        name: 'Developer Tech',
        headingFont: 'Space Grotesk',
        bodyFont: 'Plus Jakarta Sans',
        description: 'Futuristic technical headings paired with geometric body text.',
        previewText: 'Aa',
    },
];

export const getInitialFontProfile = (): FontProfile => {
    const stored = localStorage.getItem('font-profile');
    if (stored === 'modern' || stored === 'warm' || stored === 'editorial' || stored === 'developer') {
        return stored;
    }
    return 'modern';
};

export const applyFontProfile = (profile: FontProfile) => {
    document.documentElement.setAttribute('data-font-profile', profile);
    localStorage.setItem('font-profile', profile);
};

const FontProfileSelector: React.FC = () => {
    const [activeProfile, setActiveProfile] = useState<FontProfile>(getInitialFontProfile);

    const selectProfile = (profile: FontProfile) => {
        setActiveProfile(profile);
        applyFontProfile(profile);
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-bold mb-1 text-[hsl(var(--text-primary))]">Typography Styling</h3>
                <p className="text-sm text-[hsl(var(--text-secondary))]">Choose a typography pairing profile to customize the look, feel, and reading comfort of the Studio.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fontProfiles.map((profile) => (
                    <div
                        key={profile.id}
                        onClick={() => selectProfile(profile.id)}
                        className={`border rounded-xl p-5 cursor-pointer transition-all flex flex-col justify-between hover:border-[hsl(var(--border-hover))] ${
                            activeProfile === profile.id
                                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-sm ring-1 ring-[hsl(var(--primary))]'
                                : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))]'
                        }`}
                    >
                        <div className="mb-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-sm text-[hsl(var(--text-primary))]">{profile.name}</span>
                                {activeProfile === profile.id && (
                                    <span className="text-[9px] bg-[hsl(var(--primary))] text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Active
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-[hsl(var(--text-secondary))] leading-relaxed">{profile.description}</p>
                        </div>
                        <div className="mt-auto border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--surface-elevated))] p-3 flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-widest font-semibold">Font Pairing</div>
                                <div className="text-xs flex items-center space-x-1.5 text-[hsl(var(--text-secondary))] font-medium">
                                    <span style={{ fontFamily: profile.headingFont === 'Lora' ? 'Lora, Georgia, serif' : profile.headingFont }} className="text-sm font-semibold">
                                        {profile.headingFont}
                                    </span>
                                    <span className="text-[hsl(var(--text-tertiary))]">/</span>
                                    <span style={{ fontFamily: profile.bodyFont }} className="text-xs">
                                        {profile.bodyFont}
                                    </span>
                                </div>
                            </div>
                            <div
                                style={{
                                    fontFamily: profile.headingFont === 'Lora' ? 'Lora, Georgia, serif' : profile.headingFont,
                                }}
                                className="text-xl font-bold bg-[hsl(var(--surface))] border border-[hsl(var(--border))] w-10 h-10 rounded flex items-center justify-center shadow-sm text-[hsl(var(--text-primary))]"
                            >
                                {profile.previewText}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FontProfileSelector;
