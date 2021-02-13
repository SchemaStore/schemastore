.PHONY: build remote

build: # Run the local build process
	cd src && \
	npm install && \
	npm run build
	git diff-index --quiet HEAD -- || { \
		echo "ERROR: Dirty repository found"; \
		git status --porcelain; \
		exit 1; }

remote: # Run the remote build process
	cd src && \
	npm install && \
	npm run remote
