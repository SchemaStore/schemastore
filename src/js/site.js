/* global ga, get */

;(function (global) {
  global.get = function (url, asJson, callback) {
    let xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.onload = function () {
      if (asJson) callback(JSON.parse(xhr.responseText), url)
      else callback(xhr.responseText, url)
    }

    xhr.send()
  }

  let ul = document.querySelector('#schemalist ul')
  let p = document.getElementById('count')
  let schemas = document.getElementById('schemas')
  let search = document.getElementById('search')
  let data = []

  if (!ul || !p) return

  if (schemas !== null) {
    let api = schemas.getAttribute('data-api')

    get(api, true, function (catalog) {
      p.innerHTML = p.innerHTML.replace('{0}', catalog.schemas.length)
      data = catalog.schemas.sort(function (a, b) {
        return a.name.localeCompare(b.name)
      })

      populate(data)
    })
  }

  function populate(data) {
    for (const element of data) {
      let schema = element
      let li = document.createElement('li')
      let a = document.createElement('a')
      a.href = schema.url
      a.title = schema.description
      a.innerText = schema.name

      li.appendChild(a)
      ul.appendChild(li)
    }
  }

  search.addEventListener(
    'input',
    () => {
      let value = search.value.toLowerCase()

      setTimeout(() => {
        if (value !== search.value.toLowerCase()) return

        for (const li of ul.childNodes) {
          li.style.display =
            li.innerText.toLowerCase().indexOf(value) > -1 ? 'block' : 'none'
        }
      }, 300)
    },
    false,
  )
})(typeof window !== 'undefined' ? window : this)
