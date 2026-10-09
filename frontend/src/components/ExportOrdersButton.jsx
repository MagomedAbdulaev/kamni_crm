import { useState } from 'react'
import { FileSpreadsheet, LoaderCircle } from 'lucide-react'
import api from '../api.js'

function todayString() {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}


function ExportOrdersButton({ search = '' }) {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	async function download() {
		setLoading(true)
		setError('')
		try {
			const { data } = await api.get(`orders/export/${search}`, { responseType: 'blob' })
			const url = URL.createObjectURL(data)
			const link = document.createElement('a')
			link.href = url
			link.download = `orders_${todayString()}.xlsx`
			document.body.appendChild(link)
			link.click()
			link.remove()
			URL.revokeObjectURL(url)
		} catch {
			setError('Не удалось выгрузить заказы. Войдите в CRM и повторите попытку.')
		} finally {
			setLoading(false)
		}
	}

	return (
		<span className="inline-flex items-center gap-2">
			<button type="button" onClick={download} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
				{loading ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} className="text-emerald-600" />}
				Выгрузить в Excel
			</button>
			{error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
		</span>
	)
}

export default ExportOrdersButton