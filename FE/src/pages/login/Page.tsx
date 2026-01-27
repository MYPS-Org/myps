import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService, type LoginRequest } from './Service';
import { Input } from '../../components/tailwindui/input';
import { Text } from '../../components/tailwindui/text';
import Logo from '../../assets/img/logo.png';

const LoginForm: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginRequest>({
	UserName: '',
	Password: ''
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
//   const [rememberMe, setRememberMe] = useState(false);
  const { validateSession } = useAuth();
//   const Navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
	e.preventDefault();
	setError('');
	setIsLoading(true);

	try {
	  await authService.login(credentials);
	  await validateSession();
	} catch (err: any) {
	  setError(err.message || 'Login failed. Please try again.');
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

  return (
	<>
	<div className="min-h-full pt-50 flex items-center justify-center">
		<div className="bg-white rounded-3xl shadow-2xl flex w-full max-w-4xl overflow-hidden">
			{/* Left: Form */}
			<div className="w-full md:w-1/2 p-10 flex flex-col justify-center">
				{/* Welcome */}
				<h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to MYPS</h2>
				<Text className="text-gray-500 mb-8"><strong>Multi Year Planning System:</strong> Plan and manage proposed projects efficiently.</Text>
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
					<Input
						id="username"
						type="text"
						value={credentials.UserName}
						onChange={handleInputChange('UserName')}
						required
						autoComplete="username"
						disabled={isLoading}
						className="w-full !text-black border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500"
						placeholder="exaple@email.com"
					/>
					</div>
					<div>
					<Input
						id="password"
						type="password"
						value={credentials.Password}
						onChange={handleInputChange('Password')}
						required
						autoComplete="current-password"
						disabled={isLoading}
						className="w-full text-black border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-violet-500"
						placeholder="••••••••••••"
					/>
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
					{error && (
					<div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
						<svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						{error}
					</div>
					)}
					
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
