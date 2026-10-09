import { useEffect, useState } from 'react'
import { ArrowLeft, CircleAlert, LoaderCircle, Save } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api.js'
import SearchableSelect from '../components/SearchableSelect.jsx'
import materialCategories from '../components/materialCategories.js'

const fieldClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'

function NewOrderPage() {
	const navigate = useNavigate()
	const [lookups, setLookups] = useState(null)
	const [form, setForm] = useState({
		client: '',
		product_type: '',
		product_name: '',
		material: '',
		price: '',
		due_date: '',
		comment: '',
	})
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let isMounted = true
		Promise.all([
			api.get('clients/'),
			api.get('materials/'),
			api.get('product-types/'),
		])
			.then(([clients, materials, productTypes]) => {
				if (!isMounted) return
				const clientOptions = clients.data.results ?? clients.data
				const materialOptions = materials.data.results ?? materials.data
				const productOptions = productTypes.data.results ?? productTypes.data
				setLookups({
					clients: clientOptions,
					materials: materialOptions,
					productTypes: productOptions,
				})
				setForm((current) => ({
					...current,
					client: clientOptions[0] ? String(clientOptions[0].id) : '',
					material: materialOptions[0] ? String(materialOptions[0].id) : '',
					product_type: productOptions[0] ? String(productOptions[0].id) : '',
				}))
			})
			.catch(() => {
				if (isMounted) setError('Не удалось загрузить справочники. Войдите в CRM и попробуйте снова.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [])

	function setField(name, value) {
		setForm((current) => ({ ...current, [name]: value }))
	}

	async function createOrder(event) {
		event.preventDefault()
		if (!form.client || !form.product_type || !form.material) {
			setError('Выберите клиента, тип изделия и материал из результатов поиска.')
			return
		}
		setSaving(true)
		setError('')
		try {
			const { data } = await api.post('orders/', {
				client: Number(form.client),
				product_type: Number(form.product_type),
				product_name: form.product_name,
				material: Number(form.material),
				price: form.price || '0.00',
				due_date: form.due_date || null,
				comment: form.comment,
			})
			navigate(`/orders/${data.number}`)
		} catch (requestError) {
			const responseData = requestError.response?.data
			const firstFieldError = responseData && Object.values(responseData).flat()[0]
			setError(typeof firstFieldError === 'string' ? firstFieldError : 'Не удалось создать заказ. Проверьте данные и повторите попытку.')
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="mx-auto max-w-4xl space-y-5">
			<Link to="/orders" className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 no-underline hover:text-blue-700"><ArrowLeft size={15} /> К списку заказов</Link>
			<div>
				<h3 className="m-0 font-display text-2xl font-bold text-slate-900">Новый заказ</h3>
				<p className="mt-1 mb-0 text-xs text-slate-500">Заполните данные изделия. Заказ получит статус «Новый».</p>
			</div>

			{error && <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><CircleAlert size={17} className="mt-0.5 shrink-0" />{error}</div>}

			{loading ? (
				<div className="flex min-h-52 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем справочники</div>
			) : error && !lookups ? (
				<div className="rounded-lg border border-slate-200 bg-white p-5 text-xs text-slate-500">Проверьте соединение и авторизацию, затем обновите страницу.</div>
			) : !lookups?.clients.length ? (
				<div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">Сначала добавьте клиента, затем можно оформить заказ.</div>
			) : (
				<form onSubmit={createOrder} className="space-y-4">
					<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
						<h2 className="mb-4 mt-0 border-b border-slate-100 pb-3 font-display text-sm font-bold text-slate-900">Клиент и изделие</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							<SearchableSelect id="order-client-search" label="Клиент *" placeholder="Поиск по имени или телефону" options={lookups.clients} value={form.client} onChange={(value) => setField('client', value)} getLabel={(client) => `${client.first_name} ${client.last_name}`.trim()} getSearchText={(client) => client.phone} getDetail={(client) => client.phone} />
							<SearchableSelect id="order-product-type-search" label="Тип изделия *" placeholder="Поиск типа изделия" options={lookups.productTypes} value={form.product_type} onChange={(value) => setField('product_type', value)} getLabel={(type) => type.name} getSearchText={(type) => type.name} getDetail={() => ''} />
							<label><span className={labelClass}>Название изделия</span><input value={form.product_name} onChange={(event) => setField('product_name', event.target.value)} placeholder="Например, столешница для кухни" className={fieldClass} /></label>
							<SearchableSelect id="order-material-search" label="Материал *" placeholder="Поиск материала или категории" options={lookups.materials} value={form.material} onChange={(value) => setField('material', value)} getLabel={(material) => material.name} getSearchText={(material) => `${materialCategories[material.category] ?? material.category} ${material.thickness_mm ?? ''}`} getDetail={(material) => `${materialCategories[material.category] ?? material.category}${material.thickness_mm ? ` · ${material.thickness_mm} мм` : ''}`} />
						</div>
					</section>

					<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
						<h2 className="mb-4 mt-0 border-b border-slate-100 pb-3 font-display text-sm font-bold text-slate-900">Стоимость и срок</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							<label><span className={labelClass}>Стоимость, ₽ *</span><input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setField('price', event.target.value)} placeholder="0" className={fieldClass} /></label>
							<label><span className={labelClass}>Желаемый срок</span><input type="date" value={form.due_date} onChange={(event) => setField('due_date', event.target.value)} className={fieldClass} /></label>
						</div>
					</section>

					<section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
						<label><span className={labelClass}>Комментарий к заказу</span><textarea rows="4" value={form.comment} onChange={(event) => setField('comment', event.target.value)} placeholder="Пожелания клиента, детали изготовления" className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
					</section>

					<div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Создать заказ</button></div>
				</form>
			)}
		</div>
	)
}

export default NewOrderPage