import { useEffect, useState } from 'react'
import { ArrowLeft, Check, FilePlus2, LoaderCircle, Pencil, Save, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import api from '../api.js'
import SearchableSelect from '../components/SearchableSelect.jsx'
import materialCategories from '../components/materialCategories.js'

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

const statuses = [
	{ value: 'new', label: 'Новый' },
	{ value: 'in_progress', label: 'В работе' },
	{ value: 'ready', label: 'Готов' },
	{ value: 'issued', label: 'Выдан' },
	{ value: 'cancelled', label: 'Отменён' },
]

const statusColors = {
	new: 'bg-sky-50 text-sky-700',
	in_progress: 'bg-amber-50 text-amber-700',
	ready: 'bg-emerald-50 text-emerald-700',
	issued: 'bg-slate-100 text-slate-700',
	cancelled: 'bg-rose-50 text-rose-700',
}

function dateTime(value) {
	if (!value) return '—'
	return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function Section({ title, children, action }) {
	return <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><h2 className="m-0 font-display text-sm font-bold text-slate-900">{title}</h2>{action}</div>{children}</section>
}

function OrderDetailPage() {
	const { orderId } = useParams()
	const [order, setOrder] = useState(null)
	const [comments, setComments] = useState([])
	const [lookups, setLookups] = useState(null)
	const [form, setForm] = useState(null)
	const [editing, setEditing] = useState(false)
	const [statusDraft, setStatusDraft] = useState('')
	const [statusComment, setStatusComment] = useState('')
	const [newComment, setNewComment] = useState('')
	const [selectedFile, setSelectedFile] = useState(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	useEffect(() => {
		let isMounted = true
		Promise.all([
			api.get(`orders/${orderId}/`),
			api.get(`orders/${orderId}/comments/`),
		])
			.then(([orderResponse, commentsResponse]) => {
				if (!isMounted) return
				setOrder(orderResponse.data)
				setComments(commentsResponse.data)
				setStatusDraft(orderResponse.data.status)
			})
			.catch(() => {
				if (isMounted) setError('Не удалось загрузить заказ. Войдите в CRM и обновите страницу.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [orderId])

	async function beginEdit() {
		setError('')
		setNotice('')
		setForm({
			client: String(order.client),
			product_type: String(order.product_type),
			product_name: order.product_name ?? '',
			material: String(order.material),
			price: String(order.price ?? '0'),
			due_date: order.due_date ?? '',
			comment: order.comment ?? '',
			processing_details: order.processing_details.map((item) => ({
				processing_type: String(item.processing_type),
				parameters: item.parameters ?? {},
			})),
		})
		setEditing(true)
		if (lookups) return
		try {
			const [clients, materials, productTypes, processingTypes] = await Promise.all([
				api.get('clients/'),
				api.get('materials/'),
				api.get('product-types/'),
				api.get('processing-types/'),
			])
			setLookups({
				clients: clients.data.results ?? clients.data,
				materials: materials.data.results ?? materials.data,
				productTypes: productTypes.data.results ?? productTypes.data,
				processingTypes: processingTypes.data.results ?? processingTypes.data,
			})
		} catch {
			setError('Не удалось загрузить справочники для редактирования.')
		}
	}

	function setField(name, value) {
		setForm((current) => ({ ...current, [name]: value }))
	}

	function toggleProcessing(typeId, checked) {
		setForm((current) => {
			const existing = current.processing_details.find((item) => item.processing_type === typeId)
			const processingDetails = checked
				? [...current.processing_details, { processing_type: typeId, parameters: {} }]
				: current.processing_details.filter((item) => item.processing_type !== typeId)
			if (checked && existing) return current
			return { ...current, processing_details: processingDetails }
		})
	}

	async function saveOrder(event) {
		event.preventDefault()
		setSaving(true)
		setError('')
		setNotice('')
		try {
			const { data } = await api.patch(`orders/${orderId}/`, {
				client: Number(form.client),
				product_type: Number(form.product_type),
				product_name: form.product_name,
				material: Number(form.material),
				price: form.price,
				due_date: form.due_date || null,
				comment: form.comment,
				processing_details: form.processing_details,
			})
			setOrder(data)
			setStatusDraft(data.status)
			setEditing(false)
			setNotice('Изменения сохранены.')
		} catch (requestError) {
			setError(requestError.response?.data?.detail ?? 'Не удалось сохранить заказ. Проверьте заполненные поля.')
		} finally {
			setSaving(false)
		}
	}

	async function changeStatus(event) {
		event.preventDefault()
		if (statusDraft === order.status) return
		setSaving(true)
		setError('')
		setNotice('')
		try {
			const { data } = await api.patch(`orders/${orderId}/status/`, { status: statusDraft, comment: statusComment })
			setOrder(data)
			setStatusComment('')
			setNotice('Статус заказа изменён.')
		} catch (requestError) {
			setError(requestError.response?.data?.status?.[0] ?? requestError.response?.data?.detail ?? 'Не удалось изменить статус.')
		} finally {
			setSaving(false)
		}
	}

	async function addComment(event) {
		event.preventDefault()
		const text = newComment.trim()
		if (!text) return
		setSaving(true)
		setError('')
		try {
			const { data } = await api.post(`orders/${orderId}/comments/`, { text })
			setComments((current) => [...current, data])
			setNewComment('')
		} catch {
			setError('Не удалось добавить комментарий.')
		} finally {
			setSaving(false)
		}
	}

	async function uploadAttachment(event) {
		event.preventDefault()
		if (!selectedFile) return
		const body = new FormData()
		body.append('file', selectedFile)
		body.append('original_name', selectedFile.name)
		setSaving(true)
		setError('')
		try {
			await api.post(`orders/${orderId}/attachments/`, body)
			const { data } = await api.get(`orders/${orderId}/`)
			setOrder(data)
			setSelectedFile(null)
			setNotice('Файл прикреплён.')
		} catch {
			setError('Не удалось загрузить файл.')
		} finally {
			setSaving(false)
		}
	}

	if (loading) return <div className="flex min-h-60 items-center justify-center text-sm text-slate-500"><LoaderCircle size={22} className="mr-2 animate-spin" /> Загружаем заказ</div>
	if (error && !order) return <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">{error} <a className="ml-2 font-semibold underline" href={`/api-auth/login/?next=${encodeURIComponent(`/orders/${orderId}`)}`}>Войти</a></section>
	if (!order) return null

	const currentStatus = statuses.find((status) => status.value === order.status)
	const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
	const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'

	return (
		<div className="space-y-5">
			<Link to="/orders" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 no-underline hover:text-blue-700"><ArrowLeft size={15} /> К списку заказов</Link>

			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex flex-wrap items-center gap-3">
						<h3 className="m-0 font-display text-2xl font-bold text-slate-900">Заказ №{order.number}</h3>
						<span className={`rounded px-2.5 py-1 text-[11px] font-semibold ${statusColors[order.status]}`}>{currentStatus?.label}</span>
					</div>
					<p className="mt-1 mb-0 text-sm text-slate-600">{order.product_name || order.product_type_name} · {order.client_name}</p>
				</div>
				{!editing && <button type="button" onClick={beginEdit} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Редактировать</button>}
			</div>

			{error && <p role="alert" className="m-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
			{notice && <p role="status" className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}

			{editing && form && <form onSubmit={saveOrder} className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
				<div className="mb-4 flex items-center justify-between gap-3"><h2 className="m-0 font-display text-sm font-bold text-slate-900">Редактирование заказа</h2><button type="button" onClick={() => setEditing(false)} className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-white" aria-label="Закрыть редактирование"><X size={17} /></button></div>
				{!lookups ? <div className="py-5 text-center text-xs text-slate-500"><LoaderCircle className="mr-2 inline animate-spin" size={16} />Загружаем справочники</div> : <>
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
						<SearchableSelect id="edit-order-client-search" label="Клиент" placeholder="Поиск по имени или телефону" options={lookups.clients} value={form.client} onChange={(value) => setField('client', value)} getLabel={(client) => `${client.first_name} ${client.last_name}`.trim()} getSearchText={(client) => client.phone} getDetail={(client) => client.phone} />
						<SearchableSelect id="edit-order-product-type-search" label="Тип изделия" placeholder="Поиск типа изделия" options={lookups.productTypes} value={form.product_type} onChange={(value) => setField('product_type', value)} getLabel={(type) => type.name} getSearchText={(type) => type.name} getDetail={() => ''} />
						<SearchableSelect id="edit-order-material-search" label="Материал" placeholder="Поиск материала или категории" options={lookups.materials} value={form.material} onChange={(value) => setField('material', value)} getLabel={(material) => material.name} getSearchText={(material) => `${materialCategories[material.category] ?? material.category} ${material.thickness_mm ?? ''}`} getDetail={(material) => `${materialCategories[material.category] ?? material.category}${material.thickness_mm ? ` · ${material.thickness_mm} мм` : ''}`} />
						<label><span className={labelClass}>Название изделия</span><input value={form.product_name} onChange={(event) => setField('product_name', event.target.value)} className={inputClass} /></label>
						<label><span className={labelClass}>Цена, ₽</span><input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setField('price', event.target.value)} className={inputClass} /></label>
						<label><span className={labelClass}>Желаемый срок</span><input type="date" value={form.due_date} onChange={(event) => setField('due_date', event.target.value)} className={inputClass} /></label>
					</div>
					<fieldset className="mt-4 rounded-md border border-slate-200 bg-white p-3"><legend className="px-1 text-[11px] font-semibold text-slate-700">Обработка</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{lookups.processingTypes.map((type) => <label key={type.id} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.processing_details.some((item) => Number(item.processing_type) === type.id)} onChange={(event) => toggleProcessing(type.id, event.target.checked)} className="size-4 accent-blue-600" />{type.name}</label>)}</div></fieldset>
					<label className="mt-4 block"><span className={labelClass}>Комментарий к заказу</span><textarea rows="3" value={form.comment} onChange={(event) => setField('comment', event.target.value)} className={`${inputClass} h-auto py-2`} /></label>
					<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Save size={15} /> Сохранить</button></div>
				</>}</form>}

			<div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr]">
				<div className="space-y-4">
					<Section title="Изделие и клиент">
						<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
							<div><dt className="text-[10px] text-slate-500">Клиент</dt><dd className="mt-1 text-sm font-medium text-slate-900">{order.client_name}</dd></div>
							<div><dt className="text-[10px] text-slate-500">Тип изделия</dt><dd className="mt-1 text-sm font-medium text-slate-900">{order.product_type_name}</dd></div>
							<div><dt className="text-[10px] text-slate-500">Название</dt><dd className="mt-1 text-sm font-medium text-slate-900">{order.product_name || '—'}</dd></div>
							<div><dt className="text-[10px] text-slate-500">Материал</dt><dd className="mt-1 text-sm font-medium text-slate-900">{order.material_name}</dd></div>
							<div><dt className="text-[10px] text-slate-500">Создан</dt><dd className="mt-1 text-sm font-medium text-slate-900">{dateTime(order.created_at)}</dd></div>
							<div><dt className="text-[10px] text-slate-500">Срок</dt><dd className="mt-1 text-sm font-medium text-slate-900">{order.due_date || 'Не указан'}</dd></div>
						</dl>
						{order.comment && <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">{order.comment}</p>}
						<div className="mt-4 border-t border-slate-100 pt-3"><h3 className="mb-2 text-[11px] font-semibold text-slate-700">Обработка</h3>{order.processing_details.length ? <div className="flex flex-wrap gap-2">{order.processing_details.map((item) => <span key={item.id} className="rounded bg-slate-100 px-2.5 py-1.5 text-[11px] text-slate-700">{item.processing_type_name || lookups?.processingTypes.find((type) => type.id === item.processing_type)?.name || `Обработка ${item.processing_type}`}{Object.keys(item.parameters ?? {}).length > 0 && <span className="ml-1 text-slate-500">{Object.values(item.parameters).join(', ')}</span>}</span>)}</div> : <p className="m-0 text-xs text-slate-400">Обработка не указана</p>}</div>
					</Section>

					<Section title="Оплаты">
						{order.payments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[450px] text-left text-xs"><thead className="text-[10px] text-slate-500"><tr><th className="pb-2 font-medium">Дата</th><th className="pb-2 font-medium">Способ</th><th className="pb-2 text-right font-medium">Сумма</th><th className="pb-2 pl-3 font-medium">Комментарий</th></tr></thead><tbody>{order.payments.map((payment) => <tr key={payment.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60"><td className="py-2.5 text-slate-600">{dateTime(payment.paid_at)}</td><td className="py-2.5 text-slate-700">{payment.method_display ?? payment.method}</td><td className="py-2.5 text-right font-semibold text-slate-900">{money.format(Number(payment.amount) || 0)}</td><td className="py-2.5 pl-3 text-slate-500">{payment.comment || '—'}</td></tr>)}</tbody></table></div> : <p className="m-0 text-xs text-slate-400">Оплат пока нет</p>}
					</Section>

					<Section title="Вложения" action={<form onSubmit={uploadAttachment} className="flex items-center gap-2"><input aria-label="Выберите файл" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} className="max-w-44 text-[10px] text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1.5 file:text-[10px] file:font-medium file:text-slate-700" /><button type="submit" disabled={!selectedFile || saving} className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40"><FilePlus2 size={13} /> Прикрепить</button></form>}>
						{order.attachments.length ? <ul className="m-0 grid list-none gap-2 p-0">{order.attachments.map((attachment) => <li key={attachment.id}><a href={attachment.file} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-700 hover:underline">{attachment.original_name || attachment.file.split('/').pop()}</a><span className="ml-2 text-[10px] text-slate-400">{dateTime(attachment.uploaded_at)}</span></li>)}</ul> : <p className="m-0 text-xs text-slate-400">Файлы ещё не прикреплены</p>}
					</Section>

					<Section title="Комментарии">
						<form onSubmit={addComment} className="mb-4 flex gap-2"><input value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Добавить комментарий" className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><button type="submit" disabled={!newComment.trim() || saving} className="h-9 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">Добавить</button></form>
						{comments.length ? <div className="space-y-3">{comments.map((comment) => <article key={comment.id} className="border-t border-slate-100 pt-3"><div className="flex justify-between gap-3"><strong className="text-[11px] text-slate-800">{comment.author_name || 'Сотрудник'}</strong><time className="text-[10px] text-slate-400">{dateTime(comment.created_at)}</time></div><p className="mt-1 mb-0 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{comment.text}</p></article>)}</div> : <p className="m-0 text-xs text-slate-400">Комментариев пока нет</p>}
					</Section>
				</div>

				<aside className="space-y-4">
					<Section title="Стоимость">
						<div className="space-y-3"><div className="flex justify-between gap-3 text-xs"><span className="text-slate-500">Стоимость</span><strong className="text-slate-900">{money.format(Number(order.price) || 0)}</strong></div><div className="flex justify-between gap-3 text-xs"><span className="text-slate-500">Оплачено</span><strong className="text-slate-900">{money.format(Number(order.paid_amount) || 0)}</strong></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-3 text-xs"><span className="font-semibold text-slate-700">Остаток</span><strong className="text-slate-900">{money.format(Number(order.balance) || 0)}</strong></div></div>
					</Section>

					<Section title="Изменить статус">
						<form onSubmit={changeStatus} className="space-y-3"><label className="block"><span className={labelClass}>Новый статус</span><select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} className={inputClass}>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><textarea rows="2" value={statusComment} onChange={(event) => setStatusComment(event.target.value)} placeholder="Комментарий к изменению, необязательно" className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><button type="submit" disabled={saving || statusDraft === order.status} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Check size={15} /> Применить статус</button></form>
					</Section>

					<Section title="История статусов">
						{order.status_history.length ? <ol className="m-0 list-none space-y-4 border-l border-slate-200 pl-4">{[...order.status_history].reverse().map((item) => <li key={item.id} className="relative"><span className="absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-white bg-blue-500 ring-1 ring-blue-200" /><div className="text-xs font-semibold text-slate-800">{item.old_status ? `${statuses.find((status) => status.value === item.old_status)?.label ?? item.old_status} → ` : ''}{statuses.find((status) => status.value === item.new_status)?.label ?? item.new_status}</div><div className="mt-1 text-[10px] text-slate-400">{dateTime(item.changed_at)}{item.changed_by_name ? ` · ${item.changed_by_name}` : ''}</div>{item.comment && <p className="mt-1 mb-0 text-[11px] text-slate-600">{item.comment}</p>}</li>)}</ol> : <p className="m-0 text-xs text-slate-400">История пока пуста</p>}
					</Section>
				</aside>
			</div>
		</div>
	)
}

export default OrderDetailPage