import { useState } from 'react'
import { ArrowDown, Check, Search } from 'lucide-react'

const inputClass = 'h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function SearchableSelect({ id, label, placeholder, options, value, onChange, getLabel, getSearchText, getDetail }) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const [activeIndex, setActiveIndex] = useState(0)
	const selectedOption = options.find((option) => String(option.id) === value)
	const selectedLabel = selectedOption ? getLabel(selectedOption) : ''
	const normalizedSearch = search.trim().toLocaleLowerCase('ru-RU')
	const filteredOptions = normalizedSearch
		? options.filter((option) => `${getLabel(option)} ${getSearchText(option)}`.toLocaleLowerCase('ru-RU').includes(normalizedSearch))
		: options

	function selectOption(option) {
		onChange(String(option.id))
		setSearch('')
		setOpen(false)
		setActiveIndex(0)
	}

	function handleKeyDown(event) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setOpen(true)
			setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			setActiveIndex((current) => Math.max(current - 1, 0))
		} else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
			event.preventDefault()
			selectOption(filteredOptions[activeIndex])
		} else if (event.key === 'Escape') {
			setOpen(false)
			setSearch('')
		}
	}

	return (
		<div className="relative">
			<label htmlFor={id} className="mb-1.5 block text-[11px] font-medium text-slate-600">{label}</label>
			<div className="relative">
				<Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
				<input
					id={id}
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={`${id}-options`}
					aria-activedescendant={open && filteredOptions[activeIndex] ? `${id}-option-${filteredOptions[activeIndex].id}` : undefined}
					autoComplete="off"
					required={!value}
					value={open ? search : selectedLabel}
					placeholder={placeholder}
					className={`${inputClass} pr-10 pl-9`}
					onFocus={() => {
						setOpen(true)
						setSearch('')
						setActiveIndex(0)
					}}
					onChange={(event) => {
						setSearch(event.target.value)
						setOpen(true)
						setActiveIndex(0)
					}}
					onKeyDown={handleKeyDown}
					onBlur={(event) => {
						if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false)
					}}
				/>
				<button type="button" aria-label={open ? 'Закрыть список' : 'Показать список'} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen((current) => !current); setSearch('') }} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowDown size={14} /></button>
			</div>
			{open && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
				{filteredOptions.length ? <ul id={`${id}-options`} role="listbox" aria-label={label.replace(' *', '')} className="m-0 list-none p-0">{filteredOptions.map((option, index) => <li key={option.id} id={`${id}-option-${option.id}`} role="option" aria-selected={String(option.id) === value}>
					<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)} onMouseEnter={() => setActiveIndex(index)} className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${index === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
						<span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-800">{getLabel(option)}</span>{getDetail(option) && <span className="mt-0.5 block truncate text-[10px] text-slate-500">{getDetail(option)}</span>}</span>
						{String(option.id) === value && <Check size={15} className="shrink-0 text-blue-600" />}
					</button>
				</li>)}</ul> : <p className="m-0 px-3 py-4 text-center text-xs text-slate-400">Ничего не найдено</p>}
			</div>}
		</div>
	)
}

export default SearchableSelect