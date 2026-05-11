import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService, type LoginRequest } from './Service';
import { Input } from '../../components/tailwindui/input';
import { Text } from '../../components/tailwindui/text';
import Logo from '../../assets/img/logo.png';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/16/solid';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/toaster/ToasterContext';

const LoginForm: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginRequest>({
	UserName: '',
	Password: ''
  });
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
//   const [rememberMe, setRememberMe] = useState(false);
  const { validateSession } = useAuth();
  const { showToast } = useToast();
//   const Navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
	e.preventDefault();
	setSubmitted(true);
	if (!credentials.UserName || !credentials.Password) return;
	setError('');
	setIsLoading(true);

	try {
	  await authService.login(credentials);
	  await validateSession();
	} catch (err: any) {
	  const message = err.Message || err.message || 'Login failed. Please try again.';
	  showToast({ type: 'error', message });
	  setError(message);
	} finally {
	  setIsLoading(false);
	}
  };

  const handleInputChange = (field: keyof LoginRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
	setCredentials((prev: LoginRequest) => ({
	  ...prev,
	  [field]: e.target.value
	}));
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
	<>
	<div className="min-h-full pt-50 flex items-center justify-center">
		<div className="bg-white rounded-3xl shadow-2xl flex w-full max-w-4xl overflow-hidden">
			{/* Left: Form */}
			<div className="w-full md:w-1/2 p-10 flex flex-col justify-center">
				{/* Welcome */}
				<h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MYPS</h2>
				<Text className="text-gray-500 mb-8"><strong>Multi-Year Planning and Scheduling Application:</strong> Plan and manage proposed projects efficiently.</Text>
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
					<Input
						id="username"
						type="text"
						value={credentials.UserName}
						onChange={handleInputChange('UserName')}
						autoComplete="username"
						disabled={isLoading}
						className={`w-full !text-black rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 ${submitted && !credentials.UserName ? 'border-2 border-red-500 ring-2 ring-red-300' : 'border border-gray-200'}`}
						placeholder="exaple@email.com"
					/>
					{submitted && !credentials.UserName && <p className="mt-1 text-xs text-red-500">Username is required</p>}
					</div>
					<div className="relative">
						<Input
						id="password"
						type={showPassword ? 'text' : 'password'}
						value={credentials.Password}
						onChange={handleInputChange('Password')}
						autoComplete="current-password"
						disabled={isLoading}
						className={`w-full text-black rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500 ${submitted && !credentials.Password ? 'border-2 border-red-500 ring-2 ring-red-300' : 'border border-gray-200'}`}
						placeholder="••••••••••••"
						/>
						<button
						type="button"
						onClick={togglePasswordVisibility}
						className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
						tabIndex={-1}
						>
						{showPassword ? (
							<EyeSlashIcon className="w-5 h-5" />
						) : (
							<EyeIcon className="w-5 h-5" />
						)}
						</button>
						{submitted && !credentials.Password && <p className="mt-1 text-xs text-red-500">Password is required</p>}
					</div>
					<div className="flex flex-col items-center justify-between text-sm">
					{/* <label className="flex items-center gap-2">
						<input
						type="checkbox"
						checked={rememberMe}
						onChange={() => setRememberMe(!rememberMe)}
						className="accent-violet-600"
						/>
						<span className="text-gray-700">Remember me</span>
					</label> */}
					</div>
					
					<button className='!bg-[#f0750f] !w-full !h-[50px] !rounded-md !text-white hover:!bg-[#4726ae]/80 !cursor-pointer'>Sign In</button>
				</form>
				</div>
				{/* Right: Illustration */}
				<div className="white hidden md:flex w-1/2 items-center justify-center relative">
				<img src={Logo} className="w-4/5 h-auto text-white" />
			</div>
		</div>
	</div>
	</>
  );
};

export default LoginForm;
