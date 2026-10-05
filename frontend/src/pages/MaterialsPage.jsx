import { useEffect, useState } from 'react'
import { CircleAlert, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react'
import { useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import api from '../api.js'

const number = new Intl.NumberFormat('ru-RU')

const categories = [
	{ value: 'granite', label: 'Гранит' },
	{ value: 'marble', label: 'Мрамор' },
	{ value: 'quartz', label: 'Кварц' },
	{ value: 'quartzite', label: 'Кварцит' },
	{ value: 'other', label: 'Другой' },
]

const emptyForm = { category: 'granite', name: '', thickness_mm: '', is_active: true }

function MaterialsPage() {
	const { user } = useOutletContext()
	const location = useLocation()
	const [, setSearchParams] = useSearchParams()
	const [materials, setMaterials] = useState([])
	const [count, setCount] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [searchInput, setSearchInput] = useState('')
	const [editorOpen, setEditorOpen] = useState(false)
	const [editingMaterial, setEditingMaterial] = useState(null)
	const [form, setForm] = useState(emptyForm)
	const [deleteCandidate, setDeleteCandidate] = useState(null)
	const [saving, setSaving] = useState(false)
	const params = new URLSearchParams(location.search)
	const search = params.get('search') ?? ''
	const pageNumber = Number(params.get('page') || 1)
	const isAdmin = user?.role === 'admin'

	useEffect(() => {
		let isMounted = true
		api.get(`materials/${location.search}`)
			.then(({ data }) => {
				if (!isMounted) return
				setMaterials(data.results ?? data)
				setCount(data.count ?? data.length)
			})
			.catch(() => {
				if (isMounted) setError('Не удалось загрузить материалы. Войдите в CRM и обновите страницу.')
			})
			.finally(() => {
				if (isMounted) setLoading(false)
			})
		return () => {
			isMounted = false
		}
	}, [location.search])

	function submitSearch(event) {
		event.preventDefault()
		setLoading(true)
		setError('')
		const next = new URLSearchParams(location.search)
		const value = searchInput.trim()
		if (value) next.set('search', value)
		else next.delete('search')
		next.delete('page')
		setSearchParams(next)
	}

	function changePage(page) {
		setLoading(true)
		const next = new URLSearchParams(location.search)
		next.set('page', String(page))
		setSearchParams(next)
	}

	function openCreate() {
		setEditingMaterial(null)
		setForm(emptyForm)
		setError('')
		setEditorOpen(true)
	}

	function openEdit(material) {
		setEditingMaterial(material)
		setForm({ category: material.category, name: material.name, thickness_mm: material.thickness_mm ?? '', is_active: material.is_active })
		setError('')
		setEditorOpen(true)
	}

	async function saveMaterial(event) {
		event.preventDefault()
		setSaving(true)
		setError('')
		setNotice('')
		try {
			const payload = { ...form, thickness_mm: form.thickness_mm ? Number(form.thickness_mm) : null }
			const { data } = editingMaterial
				? await api.patch(`materials/${editingMaterial.id}/`, payload)
				: await api.post('materials/', payload)
			setEditorOpen(false)
			setNotice(editingMaterial ? 'Материал обновлён.' : `Материал «${data.name}» добавлен.`)
			if (search) setSearchParams({ search })
			else setSearchParams({})
			if (!search) {
				setMaterials((current) => editingMaterial
					? current.map((item) => item.id === data.id ? data : item)
					: [data, ...current.filter((item) => item.id !== data.id)])
				if (!editingMaterial) setCount((current) => current + 1)
			}
		} catch (requestError) {
			const responseData = requestError.response?.data
			const firstError = responseData && Object.values(responseData).flat()[0]
			setError(typeof firstError === 'string' ? firstError : 'Не удалось сохранить материал. Проверьте категорию и название.')
		} finally {
			setSaving(false)
		}
	}

	async function deleteMaterial() {
		if (!deleteCandidate) return
		setSaving(true)
		setError('')
		setNotice('')
		try {
			await api.delete(`materials/${deleteCandidate.id}/`)
			setMaterials((current) => current.filter((item) => item.id !== deleteCandidate.id))
			setCount((current) => Math.max(0, current - 1))
			setNotice(`Материал «${deleteCandidate.name}» удалён.`)
			setDeleteCandidate(null)
		} catch (requestError) {
			setError(requestError.response?.data?.detail ?? 'Не удалось удалить материал.')
			setDeleteCandidate(null)
		} finally {
			setSaving(false)
		}
	}

	const firstRow = count ? (pageNumber - 1) * 30 + 1 : 0
	const lastRow = Math.min(pageNumber * 30, count)
	const loginNext = encodeURIComponent(`${location.pathname}${location.search}`)
	const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
	const labelClass = 'mb-1.5 block text-[11px] font-medium text-slate-600'

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div><h3 className="m-0 font-display text-2xl font-bold text-slate-900">Материалы</h3><p className="mt-1 mb-0 text-xs text-slate-500">Справочник камня, используемого в заказах.</p></div>
				{isAdmin && <button type="button" onClick={openCreate} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} /> Добавить материал</button>}
			</div>

			{notice && <p role="status" className="m-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
			{error && !editorOpen && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><CircleAlert size={16} />{error}<a className="ml-auto font-semibold underline" href={`/api-auth/login/?next=${loginNext}`}>Войти</a></div>}

			<section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Поиск материалов"><div className="flex flex-wrap items-end justify-between gap-3"><form key={search} onSubmit={submitSearch} className="w-full max-w-xl"><label htmlFor="material-search" className={labelClass}>Поиск материала</label><div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={16} className="shrink-0 text-slate-400" /><input id="material-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Название или категория" className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" /><button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-blue-700">Найти</button></div></form><span className="text-xs text-slate-500">Материалов: <strong className="text-slate-800">{loading ? '…' : number.format(count)}</strong></span></div></section>

			{loading ? <div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><LoaderCircle size={21} className="mr-2 animate-spin" /> Загружаем материалы</div> : error && !materials.length ? <div className="rounded-lg border border-slate-200 bg-white p-5 text-xs text-slate-500">Войдите в CRM, чтобы просматривать справочник.</div> : <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-xs"><thead className="bg-slate-50 text-[10px] font-semibold uppercase text-slate-500"><tr>{['Название', 'Категория', 'Толщина', 'Статус', ...(isAdmin ? ['Действия'] : [])].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>{materials.map((material) => <tr key={material.id} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 text-slate-700 hover:bg-blue-50/60"><td className="px-4 py-3 font-semibold text-slate-900">{material.name}</td><td className="px-4 py-3">{categories.find((category) => category.value === material.category)?.label ?? material.category}</td><td className="px-4 py-3">{material.thickness_mm ? `${material.thickness_mm} мм` : '—'}</td><td className="px-4 py-3"><span className={`rounded px-2 py-1 text-[10px] font-semibold ${material.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{material.is_active ? 'Активен' : 'Неактивен'}</span></td>{isAdmin && <td className="px-4 py-3"><div className="flex items-center gap-2"> <button type="button" onClick={() => openEdit(material)} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50">Изменить</button>{deleteCandidate?.id === material.id ? <><button type="button" disabled={saving} onClick={deleteMaterial} className="rounded bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Подтвердить</button><button type="button" onClick={() => setDeleteCandidate(null)} className="rounded border border-slate-200 px-2 py-1.5 text-[10px] text-slate-600">Отмена</button></> : <button type="button" onClick={() => { setError(''); setDeleteCandidate(material) }} className="inline-flex items-center gap-1 rounded border border-rose-200 px-2.5 py-1.5 text-[10px] font-medium text-rose-700 hover:bg-rose-50"><Trash2 size={12} /> Удалить</button>}</div></td>}</tr>)}{!materials.length && <tr><td colSpan={isAdmin ? 5 : 4} className="px-4 py-12 text-center text-slate-400">Материалы не найдены</td></tr>}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500"><span>Показаны {firstRow}–{lastRow} из {number.format(count)}</span><div className="flex items-center gap-2"><button type="button" disabled={pageNumber <= 1 || loading} onClick={() => changePage(pageNumber - 1)} className="h-8 rounded border border-slate-200 px-3 hover:bg-slate-50 disabled:opacity-40">Назад</button><span>Страница {pageNumber}</span><button type="button" disabled={lastRow >= count || loading} onClick={() => changePage(pageNumber + 1)} className="h-8 rounded border border-slate-200 px-3 hover:bg-slate-50 disabled:opacity-40">Далее</button></div></div></section>}

			{editorOpen && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false) }}><section role="dialog" aria-modal="true" aria-labelledby="material-editor-title" className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3"><h2 id="material-editor-title" className="m-0 font-display text-lg font-bold text-slate-900">{editingMaterial ? 'Изменить материал' : 'Новый материал'}</h2><button type="button" onClick={() => setEditorOpen(false)} aria-label="Закрыть" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">×</button></div>{error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}<form onSubmit={saveMaterial} className="space-y-4"><label className="block"><span className={labelClass}>Категория *</span><select required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={inputClass}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label><label className="block"><span className={labelClass}>Название *</span><input required maxLength="120" autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Например, Carrara" className={inputClass} /></label><label className="block"><span className={labelClass}>Толщина, мм</span><input type="number" min="1" step="1" value={form.thickness_mm} onChange={(event) => setForm((current) => ({ ...current, thickness_mm: event.target.value }))} placeholder="Например, 20" className={inputClass} /></label><label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} className="size-4 accent-blue-600" /> Активен для новых заказов</label><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setEditorOpen(false)} className="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Отмена</button><button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving && <LoaderCircle size={14} className="animate-spin" />}{editingMaterial ? 'Сохранить' : 'Добавить'}</button></div></form></section></div>}
		</div>
	)
}

export default MaterialsPage