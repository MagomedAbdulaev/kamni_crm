import axios from 'axios'

const api = axios.create({
	baseURL: '/api/',
	withCredentials: true,
})

function getCookie(name) {
	const cookie = document.cookie
		.split('; ')
		.find((item) => item.startsWith(`${name}=`))
	return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null
}

api.interceptors.request.use((config) => {
	const method = config.method?.toLowerCase()
	if (method && !['get', 'head', 'options'].includes(method)) {
		const csrfToken = getCookie('csrftoken')
		if (csrfToken) config.headers.set('X-CSRFToken', csrfToken)
	}
	return config
})

export default api