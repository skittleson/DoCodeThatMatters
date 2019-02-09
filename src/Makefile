
build: node_modules
	node index.js

publish: build
	powershell -c 'cp -r -Force build/* ../docs'

node_modules: package.json
	npm install

.PHONY: build
