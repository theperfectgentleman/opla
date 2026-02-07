import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Phone, Lock, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import OTPInput from '../components/OTPInput';
import ThemeToggle from '../components/ThemeToggle';

type TabType = 'email' | 'otp';

const Login: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('email');
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        phone: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [devOtp, setDevOtp] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(0);

    const { login, loginWithOTP, requestOTP, error, clearError } = useAuth();
    const navigate = useNavigate();

    // Resend timer countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    // Validate email login
    const validateEmailForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Validate phone
    const validatePhoneForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.phone) {
            newErrors.phone = 'Phone number is required';
        } else if (!/^\+?[0-9]{10,15}$/.test(formData.phone.replace(/\s/g, ''))) {
            newErrors.phone = 'Invalid phone number format';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle email login
    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (!validateEmailForm()) return;

        try {
            setIsLoading(true);
            await login(formData.email, formData.password);
            navigate('/dashboard');
        } catch (err) {
            // Error handled by context
        } finally {
            setIsLoading(false);
        }
    };

    // Request OTP
    const handleRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();

        if (!validatePhoneForm()) return;

        try {
            setIsLoading(true);
            const result = await requestOTP(formData.phone);

            // Check if OTP is returned (dev mode)
            if (result.data?.otp) {
                setDevOtp(result.data.otp);
            }

            setOtpSent(true);
            setResendTimer(60); // 60 second cooldown
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

    return (
        <div className="min-h-screen flex items-center justify-center p-4 animated-gradient">
            <div className="w-full max-w-md space-y-4">
                <div className="flex justify-end">
                    <ThemeToggle />
                </div>
                {/* Card */}
                <div className="card-glass fade-in">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
                        <p className="text-[hsl(var(--text-secondary))]">
                            Sign in to continue to Opla Studio
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
                                setActiveTab('otp');
                                setErrors({});
                                clearError();
                                setOtpSent(false);
                            }}
                            className={`flex-1 ${activeTab === 'otp' ? 'tab tab-active' : 'tab tab-inactive'}`}
                        >
                            <Phone className="w-4 h-4 mr-2" />
                            Phone OTP
                        </button>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-[hsl(var(--error))]/10 border border-[hsl(var(--error))]/30 rounded-xl p-4 mb-6">
                            <p className="text-[hsl(var(--error))] text-sm">{error}</p>
                        </div>
                    )}

                    {/* Email Login Form */}
                    {activeTab === 'email' && (
                        <form onSubmit={handleEmailLogin} className="space-y-4">
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
                                        autoFocus
                                    />
                                </div>
                                {errors.email && <p className="error-text">{errors.email}</p>}
                            </div>

                            {/* Password */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="label !mb-0">Password</label>
                                    <button type="button" className="text-sm link">
                                        Forgot password?
                                    </button>
                                </div>
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
                            </div>

                            {/* Submit Button */}
                            <button type="submit" className="btn btn-primary w-full mt-6" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>
                    )}

                    {/* Phone OTP Login */}
                    {activeTab === 'otp' && !otpSent && (
                        <form onSubmit={handleRequestOTP} className="space-y-4">
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
                                        autoFocus
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
                    {activeTab === 'otp' && otpSent && (
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

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setOtpSent(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Change Number
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRequestOTP}
                                    disabled={resendTimer > 0 || isLoading}
                                    className="btn btn-ghost flex-1"
                                >
                                    {resendTimer > 0 ? (
                                        `Resend in ${resendTimer}s`
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                            Resend OTP
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-[hsl(var(--text-secondary))]">
                            Don't  have an account?{' '}
                            <Link to="/register" className="link">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
