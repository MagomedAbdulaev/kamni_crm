import { useEffect, useState } from 'react'
import { LoaderCircle, Search, UserRound, ClipboardList, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'

const ORDERS_ROUTE = '/orders' // страница заказов, читает ?search=
const CLIENTS_ROUTE = '/clients' // страница клиентов, читает ?search=
const LIMIT = 5
const MIN_LENGTH = 2

const statusLabels = { new: 'Новый', in_progress: 'В работе', ready: 'Готов', issued: 'Выдан', cancelled: 'Отменён' }

function GlobalSearch() {
	const navigate = useNavigate()
	const [open, setOpen] = useState(false)
	const [text, setText] = useState('')
	const [orders, setOrders] = useState([])
	const [clients, setClients] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(false)
	const term = text.trim()
	const ready = term.length >= MIN_LENGTH

	useEffect(() => {
		const onKeyDown = (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()
				setOpen(true)
			} else if (event.key === 'Escape') {
				setOpen(false)
			}
		}
		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [])

	useEffect(() => {
		if (!open || !ready) return undefined
		let isActive = true
		setLoading(true)
		const timer = setTimeout(() => {
			Promise.all([
				api.get('orders/', { params: { search: term } }),
				api.get('clients/', { params: { search: term } }),
			])
				.then(([{ data: orderData }, { data: clientData }]) => {
					if (!isActive) return
					setOrders((orderData.results ?? orderData).slice(0, LIMIT))
					setClients((clientData.results ?? clientData).slice(0, LIMIT))
					setError(false)
				})
				.catch(() => {
					if (isActive) setError(true)
				})
				.finally(() => {
					if (isActive) setLoading(false)
				})
		}, 300)
		return () => {
			isActive = false
			clearTimeout(timer)
		}
	}, [open, ready, term])

	function close() {
		setOpen(false)
		setText('')
		setOrders([])
		setClients([])
		setError(false)
	}

	function go(path) {
		close()
		navigate(path)
	}

	const openOrder = (order) => go(`${ORDERS_ROUTE}?search=${order.number}`)
	const openClient = (client) => go(`${CLIENTS_ROUTE}?search=${encodeURIComponent(client.phone || client.first_name)}`)
	const visibleOrders = ready ? orders : []
	const visibleClients = ready ? clients : []
	const empty = ready && !loading && !error && !visibleOrders.length && !visibleClients.length

	function submit(event) {
		event.preventDefault()
		if (visibleOrders[0]) openOrder(visibleOrders[0])
		else if (visibleClients[0]) openClient(visibleClients[0])
	}

	return (
		<>
			<button className="relative grid size-9 shrink-0 place-items-center rounded-md border border-[#e4e9eb] bg-white text-[#5c6973] transition-colors hover:bg-[#edf5fb] hover:text-[#1f68ad]" type="button" aria-label="Поиск" title="Поиск (Ctrl+K)" onClick={() => setOpen(true)}>
				<Search size={19} />
			</button>

			{open && (
				<div className="fixed inset-0 z-50 flex items-start justify-center bg-[#0b1620]/45 p-4 pt-[10vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
					<div role="dialog" aria-modal="true" aria-label="Поиск" className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
						<form onSubmit={submit} className="flex items-center gap-3 border-b border-[#eef1f2] px-4">
							<Search size={18} className="shrink-0 text-[#84919b]" />
							<input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Номер заказа, клиент, телефон, изделие, материал" className="h-14 min-w-0 flex-1 border-0 bg-transparent text-sm text-[#1d2a35] outline-none placeholder:text-[#a3afb7]" />
							{loading && <LoaderCircle size={16} className="shrink-0 animate-spin text-[#84919b]" />}
							<button type="button" onClick={close} aria-label="Закрыть поиск" className="grid size-8 shrink-0 place-items-center rounded-md text-[#71808a] hover:bg-[#f1f4f5]"><X size={17} /></button>
						</form>

						<div className="max-h-[min(60vh,440px)] overflow-y-auto">
							{!ready && <p className="m-0 px-4 py-10 text-center text-xs text-[#84919b]">Введите минимум {MIN_LENGTH} символа. Быстрое открытие поиска: Ctrl+K</p>}
							{error && <p className="m-0 px-4 py-10 text-center text-xs text-[#b45309]">Не удалось выполнить поиск. Проверьте, что вы вошли в CRM.</p>}
							{empty && <p className="m-0 px-4 py-10 text-center text-xs text-[#84919b]">Ничего не найдено по запросу «{term}»</p>}

							{!error && visibleOrders.length > 0 && (
								<section>
									<h3 className="m-0 bg-[#f7f9fa] px-4 py-2 text-[10px] font-bold tracking-[1px] text-[#778690] uppercase">Заказы</h3>
									<ul className="m-0 list-none p-0">
										{visibleOrders.map((order) => (
											<li key={order.number}>
												<button type="button" onClick={() => openOrder(order)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f5f9fc]">
													<span className="grid size-8 shrink-0 place-items-center rounded-md bg-[#edf5fb] text-[#1f68ad]"><ClipboardList size={16} /></span>
													<span className="min-w-0 flex-1">
														<span className="block truncate text-xs font-semibold text-[#1d2a35]">№{order.number} · {order.product_name || order.product_type_name}</span>
														<span className="block truncate text-[11px] text-[#71808a]">{order.client_name} · {order.material_name}</span>
													</span>
													<span className="shrink-0 rounded bg-[#f1f4f5] px-2 py-1 text-[10px] text-[#56636d]">{statusLabels[order.status] ?? order.status}</span>
												</button>
											</li>
										))}
									</ul>
								</section>
							)}

							{!error && visibleClients.length > 0 && (
								<section>
									<h3 className="m-0 bg-[#f7f9fa] px-4 py-2 text-[10px] font-bold tracking-[1px] text-[#778690] uppercase">Клиенты</h3>
									<ul className="m-0 list-none p-0">
										{visibleClients.map((client) => (
											<li key={client.id}>
												<button type="button" onClick={() => openClient(client)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f5f9fc]">
													<span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f1f4f5] text-[#71808a]"><UserRound size={16} /></span>
													<span className="min-w-0 flex-1">
														<span className="block truncate text-xs font-semibold text-[#1d2a35]">{client.first_name} {client.last_name}</span>
														<span className="block truncate text-[11px] text-[#71808a]">{client.phone}</span>
													</span>
												</button>
											</li>
										))}
									</ul>
								</section>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	)
}

export default GlobalSearch