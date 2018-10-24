
build: node_modules
	node index.js

publish: build
	cp -r build/* ../docs

node_modules: package.json
	npm install

.PHONY: build
