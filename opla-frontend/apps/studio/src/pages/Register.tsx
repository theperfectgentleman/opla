import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Phone, User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import OTPInput from '../components/OTPInput';

type TabType = 'email' | 'phone';

const Register: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('email');
    const [formData, setFormData] = useState({
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        fullName: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [devOtp, setDevOtp] = useState<string | null>(null);

    const { registerEmail, registerPhone, loginWithOTP, error, clearError } = useAuth();
    const navigate = useNavigate();

    // Validate email registration
    const validateEmailForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        } else if (formData.fullName.trim().length < 2) {
            newErrors.fullName = 'Full name must be at least 2 characters';
        }

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/[A-Z]/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one uppercase letter';
        } else if (!/[0-9]/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one digit';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Validate phone registration
    const validatePhoneForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        } else if (formData.fullName.trim().length < 2) {
            newErrors.fullName = 'Full name must be at least 2 characters';
        }

        if (!formData.phone) {
            newErrors.phone = 'Phone number is required';
        } else if (!/^\+?[0-9]{10,15}$/.test(formData.phone.replace(/\s/g, ''))) {
            newErrors.phone = 'Invalid phone number format';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle email registration
    const handleEmailRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (!validateEmailForm()) return;

        try {
            setIsLoading(true);
            await registerEmail(formData.email, formData.password, formData.fullName);
            navigate('/dashboard');
        } catch (err) {
            // Error handled by context
        } finally {
            setIsLoading(false);
        }
    };

    // Handle phone registration
    const handlePhoneRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (!validatePhoneForm()) return;

        try {
            setIsLoading(true);
            const result = await registerPhone(formData.phone, formData.fullName);

            // Check if OTP is returned (dev mode)
            if (result.data?.otp) {
                setDevOtp(result.data.otp);
            }

            setOtpSent(true);
        } catch (err) {
            // Error handled by context
        } finally {
            setIsLoading(false);
        }
    };

    // Handle OTP verification
    const handleOTPComplete = async (otp: string) => {
        try {
            setIsLoading(true);
            await loginWithOTP(formData.phone, otp);
            navigate('/dashboard');
        } catch (err) {
            // Error handled by context
        } finally {
            setIsLoading(false);
        }
    };

    // Password strength indicator
    const getPasswordStrength = () => {
        const password = formData.password;
        if (!password) return { strength: 0, label: '', color: '' };

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
        const colors = [
            'bg-[hsl(var(--error))]',
            'bg-[hsl(var(--warning))]',
            'bg-[hsl(var(--info))]',
            'bg-[hsl(var(--success))]',
            'bg-[hsl(var(--success))]',
        ];

        return {
            strength: (strength / 5) * 100,
            label: labels[strength - 1] || '',
            color: colors[strength - 1] || '',
        };
    };

    const passwordStrength = getPasswordStrength();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 animated-gradient">
            <div className="w-full max-w-md">
                {/* Card */}
                <div className="card-glass fade-in">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold mb-2">Create Account</h1>
                        <p className="text-[hsl(var(--text-secondary))]">
                            Join Opla and start building amazing forms
                        </p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-2 mb-6 p-1 bg-[hsl(var(--surface-elevated))] rounded-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('email');
                                setErrors({});
                                clearError();
                                setOtpSent(false);
                            }}
                            className={`flex-1 ${activeTab === 'email' ? 'tab tab-active' : 'tab tab-inactive'}`}
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('phone');
                                setErrors({});
                                clearError();
                                setOtpSent(false);
                            }}
                            className={`flex-1 ${activeTab === 'phone' ? 'tab tab-active' : 'tab tab-inactive'}`}
                        >
                            <Phone className="w-4 h-4 mr-2" />
                            Phone
                        </button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-[hsl(var(--error))]/10 border border-[hsl(var(--error))]/30 rounded-xl p-4 mb-6">
                            <p className="text-[hsl(var(--error))] text-sm">{error}</p>
                        </div>
                    )}

                    {/* Email Registration Form */}
                    {activeTab === 'email' && (
                        <form onSubmit={handleEmailRegister} className="space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="label">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className={`input pl-12 ${errors.fullName ? 'input-error' : ''}`}
                                        placeholder="John Doe"
                                    />
                                </div>
                                {errors.fullName && <p className="error-text">{errors.fullName}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="label">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className={`input pl-12 ${errors.email ? 'input-error' : ''}`}
                                        placeholder="you@example.com"
                                    />
                                </div>
                                {errors.email && <p className="error-text">{errors.email}</p>}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="label">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className={`input pl-12 pr-12 ${errors.password ? 'input-error' : ''}`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {errors.password && <p className="error-text">{errors.password}</p>}

                                {/* Password Strength Indicator */}
                                {formData.password && (
                                    <div className="mt-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-[hsl(var(--text-secondary))]">Strength:</span>
                                            <span className="text-xs font-medium">{passwordStrength.label}</span>
                                        </div>
                                        <div className="h-2 bg-[hsl(var(--surface-elevated))] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                                                style={{ width: `${passwordStrength.strength}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div>
                                <label className="label">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className={`input pl-12 pr-12 ${errors.confirmPassword ? 'input-error' : ''}`}
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
                            </div>

                            {/* Submit Button */}
                            <button type="submit" className="btn btn-primary w-full mt-6" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Create Account'
                                )}
                            </button>
                        </form>
                    )}

                    {/* Phone Registration Form */}
                    {activeTab === 'phone' && !otpSent && (
                        <form onSubmit={handlePhoneRegister} className="space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="label">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className={`input pl-12 ${errors.fullName ? 'input-error' : ''}`}
                                        placeholder="John Doe"
                                    />
                                </div>
                                {errors.fullName && <p className="error-text">{errors.fullName}</p>}
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="label">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--text-tertiary))]" />
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className={`input pl-12 ${errors.phone ? 'input-error' : ''}`}
                                        placeholder="+254712345678"
                                    />
                                </div>
                                {errors.phone && <p className="error-text">{errors.phone}</p>}
                            </div>

                            {/* Submit Button */}
                            <button type="submit" className="btn btn-primary w-full mt-6" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Sending OTP...
                                    </>
                                ) : (
                                    'Send OTP'
                                )}
                            </button>
                        </form>
                    )}

                    {/* OTP Verification */}
                    {activeTab === 'phone' && otpSent && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-[hsl(var(--text-secondary))] mb-6">
                                    Enter the 6-digit code sent to <br />
                                    <span className="font-medium text-[hsl(var(--text-primary))]">{formData.phone}</span>
                                </p>
                                {devOtp && (
                                    <div className="bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/30 rounded-xl p-3 mb-4">
                                        <p className="text-sm text-[hsl(var(--warning))]">
                                            Dev Mode: Your OTP is <strong>{devOtp}</strong>
                                        </p>
                                    </div>
                                )}
                            </div>

                            <OTPInput onComplete={handleOTPComplete} />

                            <button
                                type="button"
                                onClick={() => setOtpSent(false)}
                                className="btn btn-ghost w-full"
                            >
                                Change Phone Number
                            </button>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-[hsl(var(--text-secondary))]">
                            Already have an account?{' '}
                            <Link to="/login" className="link">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
