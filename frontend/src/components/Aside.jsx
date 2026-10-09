import { ArrowRight, Boxes, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import navigation from './navigation.js'

function Aside({ isOpen, onClose, userName = 'Иван Петров', role = 'Менеджер', onLogout }) {
	return (
		<>
			{isOpen && <button className="fixed inset-0 z-[19] border-0 bg-[rgb(7_16_23_/_48%)] md:hidden" aria-label="Закрыть меню" onClick={onClose} />}
			<aside className={`fixed inset-y-0 left-0 z-20 flex w-[244px] flex-col bg-[#111d28] px-[14px] pt-[25px] pb-5 text-[#f7f9fb] shadow-[5px_0_22px_rgb(20_36_49_/_8%)] transition-transform duration-200 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
				<NavLink className="flex min-h-[42px] items-center gap-2.5 px-[7px] text-inherit no-underline" to="/" end onClick={onClose}>
					<span className="grid size-[27px] place-items-center text-[#eaf2f8]"><Boxes size={23} strokeWidth={2.4} /></span>
					<span className="font-display text-lg font-extrabold">StoneCRM</span>
				</NavLink>

				<nav className="mt-6 grid gap-1" aria-label="Основная навигация">
					{navigation.map(({ path, label, icon: Icon }) => (
						<NavLink
							key={path}
							to={path}
							end={path === '/'}
							className={({ isActive }) => `group relative flex min-h-[42px] items-center gap-[13px] rounded-md px-[11px] text-[13px] font-medium no-underline transition-colors before:absolute before:inset-y-[9px] before:-left-[14px] before:w-[3px] before:rounded-r ${isActive ? 'bg-[#287bc8] text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_13%)] before:bg-[#8dc6fa]' : 'text-[#e4eaf0] before:hidden hover:bg-[#1d2b39] hover:text-white'}`}
							onClick={onClose}
						>
							<Icon size={19} strokeWidth={2.1} aria-hidden="true" />
							<span>{label}</span>
						</NavLink>
					))}
				</nav>

				<div className="mt-auto flex min-h-12 items-center gap-2.5 px-1 pt-[5px]">
					<div className="grid size-[31px] shrink-0 place-items-center rounded-full border border-white/10 bg-[#354657] text-white"><UserRound size={18} strokeWidth={2} /></div>
					<div className="grid min-w-0 flex-1 gap-0.5">
						<span className="text-[10px] text-[#aeb9c3]">{role}</span>
						<strong className="truncate text-[11px] font-semibold text-[#f4f7fa]">{userName}</strong>
					</div>
				</div>
			</aside>
		</>
	)
}

export default Aside