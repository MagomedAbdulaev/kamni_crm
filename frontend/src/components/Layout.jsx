import { useState } from 'react'
import { useEffect } from 'react'
import { Bell, Menu, Search } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import api from '../api.js'
import Aside from './Aside.jsx'
import navigation from './navigation.js'

function Layout() {
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [user, setUser] = useState(null)
	const location = useLocation()
	const page = navigation.find((item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(`${item.path}/`))) ?? navigation[0]
	const PageIcon = page.icon
	useEffect(() => {
		let isMounted = true
		api.get('auth/me/')
			.then(({ data }) => {
				if (isMounted) setUser(data)
			})
			.catch(() => {})
		return () => {
			isMounted = false
		}
	}, [])
	const userName = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : 'Сотрудник'
	const userRole = user?.role === 'admin' ? 'Администратор' : 'Менеджер'

	return (
		<div className="min-h-screen bg-[#f3f5f5] font-sans text-[#1c2934] antialiased">
			<Aside
				isOpen={sidebarOpen}
				onClose={() => setSidebarOpen(false)}
				userName={userName}
				role={userRole}
			/>

			<div className="min-h-screen md:ml-[244px]">
				<header className="flex min-h-[82px] items-center justify-between gap-5 border-b border-[#e1e6e8] bg-[#fbfcfc] px-4 py-3.5 sm:px-6 md:px-[38px]">
					<button
						className="grid size-9 shrink-0 place-items-center rounded-md border border-[#e4e9eb] bg-white text-[#5c6973] md:hidden"
						type="button"
						aria-label="Открыть меню"
						aria-expanded={sidebarOpen}
						onClick={() => setSidebarOpen(true)}
					>
						<Menu size={20} />
					</button>
					<div className="grid flex-1 gap-[3px]">
						<span className="hidden text-[11px] text-[#84919b] sm:block">StoneCRM <span className="mx-[5px] text-[#b8c1c7]">/</span> {page.label}</span>
						<h1 className="m-0 font-display text-[17px] font-bold text-[#1d2a35] sm:text-[19px]">{page.label}</h1>
					</div>
					<div className="flex items-center gap-2 text-[#56636d] sm:gap-[13px]">
						<span className="mr-1 hidden text-xs text-[#71808a] sm:inline">
							{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
						</span>
						<button className="relative hidden size-9 shrink-0 place-items-center rounded-md border border-[#e4e9eb] bg-white text-[#5c6973] transition-colors hover:bg-[#edf5fb] hover:text-[#1f68ad] sm:grid" type="button" aria-label="Поиск" title="Поиск">
							<Search size={19} />
						</button>
						<button className="relative grid size-9 shrink-0 place-items-center rounded-md border border-[#e4e9eb] bg-white text-[#5c6973] transition-colors hover:bg-[#edf5fb] hover:text-[#1f68ad]" type="button" aria-label="Уведомления" title="Уведомления">
							<Bell size={19} />
							<span className="absolute top-2 right-2 size-1.5 rounded-full border border-white bg-[#dd8b52]" />
						</button>
					</div>
				</header>

				<main className="mx-auto w-full max-w-100% px-4 pt-[25px] pb-9 sm:px-[25px] md:px-[38px] md:pt-[35px] md:pb-12">
					<div className="mb-6 flex items-center gap-[13px]">
						<div className="grid size-11 place-items-center rounded-lg border border-[#dfe6e8] bg-white text-[#387eaa]"><PageIcon size={22} strokeWidth={1.9} /></div>
						<div>
							<p className="mb-1 text-[9px] font-bold tracking-[1px] text-[#778690]">РАБОЧЕЕ ПРОСТРАНСТВО</p>
							<h2 className="m-0 font-display text-[21px] font-bold text-[#1c2934]">{page.label}</h2>
						</div>
					</div>
					<Outlet context={{ user }} />
				</main>
			</div>
		</div>
	)
}

export default Layout