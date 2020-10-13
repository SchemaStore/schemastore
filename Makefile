.PHONY: build schemasafe remote

build:
	cd src && \
	npm install && \
	npm run build
	git diff-index --quiet HEAD -- || { \
		echo "ERROR: Dirty repository found"; \
		git status --porcelain; \
		exit 1; }

schemasafe:
	cd src && \
	npm install && \
	npm run schemasafe

remote:
	cd src && \
	npm install && \
	npm run remote
