import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { submissionAPI } from '../lib/api';
import {
    Send, CheckCircle2, AlertCircle, MapPin,
    Camera as CameraIcon, Layout, ShieldCheck
} from 'lucide-react';

interface PublicFormBlueprint {
    meta?: {
        title?: string;
    };
    ui: Array<{
        children: Array<{
            type: string;
            label: string;
            bind: string;
            placeholder?: string;
            options?: string[];
        }>;
    }>;
}

const PublicForm: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [blueprint, setBlueprint] = useState<PublicFormBlueprint | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [status, setStatus] = useState<'loading' | 'idle' | 'submitting' | 'success' | 'error' | 'not_found'>('loading');

    useEffect(() => {
        const fetchForm = async () => {
            if (!slug) return;
            try {
                const data = await submissionAPI.getPublicForm(slug);
                setBlueprint(data.blueprint_live || data.blueprint_draft);
                setStatus('idle');
            } catch (err) {
                setStatus('not_found');
            }
        };
        fetchForm();
    }, [slug]);

    const handleInputChange = (key: string, value: any) => {
        setFormData({ ...formData, [key]: value });
    };

    const toggleCheckboxValue = (key: string, value: string, checked: boolean) => {
        const current = Array.isArray(formData[key]) ? formData[key] : [];
        const next = checked ? [...current, value] : current.filter((v: string) => v !== value);
        handleInputChange(key, next);
    };

    const captureGPS = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                handleInputChange('location', {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slug) return;
        setStatus('submitting');
        try {
            await submissionAPI.submitPublic(slug, {
                data: formData,
                metadata: { source: 'web_public', user_agent: navigator.userAgent }
            });
            setStatus('success');
        } catch (err) {
            setStatus('error');
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (status === 'not_found') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Form Not Found</h1>
                <p className="text-slate-500 max-w-sm">This form might have been removed or set to private by the administrator.</p>
            </div>
        );
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8 animate-bounce">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">Response Submitted</h1>
                <p className="text-slate-600 max-w-sm mb-8">Thank you for your time. Your response has been securely recorded.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-indigo-600 font-bold hover:underline"
                >
                    Submit another response
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-xl mx-auto">
                {/* Header Card */}
                <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden mb-6">
                    <div className="h-3 bg-indigo-600 w-full"></div>
                    <div className="p-8 md:p-12">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                                <Layout className="w-6 h-6 text-white" />
                            </div>
                            <span className="font-bold text-slate-900">Opla Forms</span>
                        </div>
                        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">{blueprint?.meta?.title || 'Public Form'}</h1>
                        <p className="text-slate-500 font-medium">Please fill out this form. Your data is protected and encrypted.</p>
                    </div>
                </div>

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-8 md:p-12 space-y-10">
                    <div className="space-y-8">
                        {blueprint?.ui[0].children.map((field, idx) => (
                            <div key={idx} className="space-y-3">
                                <label className="text-lg font-bold text-slate-800 block">
                                    {field.label}
                                </label>

                                {field.type === 'gps_capture' ? (
                                    <button
                                        type="button"
                                        onClick={captureGPS}
                                        className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all ${formData[field.bind] ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        <div className="flex items-center space-x-4">
                                            <MapPin className={`w-6 h-6 ${formData[field.bind] ? 'text-emerald-500' : 'text-slate-400'}`} />
                                            <span className="font-bold text-lg">
                                                {formData[field.bind] ? `Location Captured` : `Share Current Location`}
                                            </span>
                                        </div>
                                    </button>
                                ) : field.type === 'photo_capture' ? (
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleInputChange(field.bind, e.target.files?.[0]?.name)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className={`w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all ${formData[field.bind] ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-slate-50 border-slate-100 text-slate-600 group-hover:bg-slate-100'}`}>
                                            <div className="flex items-center space-x-4">
                                                <CameraIcon className={`w-6 h-6 ${formData[field.bind] ? 'text-purple-500' : 'text-slate-400'}`} />
                                                <span className="font-bold text-lg">
                                                    {formData[field.bind] ? `Photo Attached` : `Add Photo`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : field.type === 'file_upload' || field.type === 'audio_recorder' ? (
                                    <input
                                        type="file"
                                        accept={field.type === 'audio_recorder' ? 'audio/*' : undefined}
                                        onChange={(e) => handleInputChange(field.bind, e.target.files?.[0]?.name)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:bg-white rounded-2xl px-6 py-5 text-slate-900 text-lg transition-all placeholder:text-slate-300 font-medium outline-none"
                                    />
                                ) : field.type === 'signature_pad' ? (
                                    <button
                                        type="button"
                                        onClick={() => handleInputChange(field.bind, 'signed')}
                                        className="w-full flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                                    >
                                        <span className="font-bold text-lg">Tap to sign</span>
                                        {formData[field.bind] && <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                                    </button>
                                ) : field.type === 'dropdown' ? (
                                    <select
                                        value={formData[field.bind] || ''}
                                        onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:bg-white rounded-2xl px-6 py-5 text-slate-900 text-lg transition-all outline-none"
                                    >
                                        <option value="" disabled>Select an option</option>
                                        {(field.options || []).map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : field.type === 'radio_group' ? (
                                    <div className="space-y-3">
                                        {(field.options || []).map((opt) => (
                                            <label key={opt} className="flex items-center gap-3 text-slate-700">
                                                <input
                                                    type="radio"
                                                    name={field.bind}
                                                    value={opt}
                                                    checked={formData[field.bind] === opt}
                                                    onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                                />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                ) : field.type === 'checkbox_group' ? (
                                    <div className="space-y-3">
                                        {(field.options || []).map((opt) => (
                                            <label key={opt} className="flex items-center gap-3 text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    checked={(formData[field.bind] || []).includes(opt)}
                                                    onChange={(e) => toggleCheckboxValue(field.bind, opt, e.target.checked)}
                                                />
                                                {opt}
                                            </label>
                                        ))}
                                    </div>
                                ) : field.type === 'toggle' ? (
                                    <label className="flex items-center gap-3 text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={!!formData[field.bind]}
                                            onChange={(e) => handleInputChange(field.bind, e.target.checked)}
                                        />
                                        Toggle
                                    </label>
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        value={formData[field.bind] || ''}
                                        onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:bg-white rounded-2xl px-6 py-5 text-slate-900 text-lg transition-all placeholder:text-slate-300 font-medium outline-none min-h-[140px]"
                                        placeholder={field.placeholder || 'Type your answer here...'}
                                        required
                                    />
                                ) : (
                                    <input
                                        type={field.type === 'input_number' ? 'number' : field.type === 'email_input' ? 'email' : field.type === 'phone_input' ? 'tel' : field.type === 'date_picker' ? 'date' : field.type === 'time_picker' ? 'time' : 'text'}
                                        value={formData[field.bind] || ''}
                                        onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 focus:bg-white rounded-2xl px-6 py-5 text-slate-900 text-lg transition-all placeholder:text-slate-300 font-medium outline-none"
                                        placeholder={field.placeholder || 'Type your answer here...'}
                                        required
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl py-6 rounded-3xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
                        >
                            {status === 'submitting' ? (
                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>Submit Form</span>
                                    <Send className="w-6 h-6" />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Footer */}
                <div className="mt-12 flex items-center justify-center space-x-4 text-slate-400">
                    <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Secure Form</span>
                    </div>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="text-xs font-bold uppercase tracking-widest">Powered by Opla</span>
                </div>
            </div>
        </div>
    );
};

export default PublicForm;
