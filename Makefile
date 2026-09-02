ENV_FILE := volume/config/app.env
PORT     ?= 8080

# ─── Docker ───────────────────────────────────────────────────────────────────

.PHONY: docker-up
docker-up:
	docker compose --env-file $(ENV_FILE) up --build

.PHONY: docker-start
docker-start:
	docker compose --env-file $(ENV_FILE) up --build -d

.PHONY: docker-stop
docker-stop:
	docker compose --env-file $(ENV_FILE) down

.PHONY: docker-build
docker-build:
	docker compose --env-file $(ENV_FILE) build

# ─── Podman ───────────────────────────────────────────────────────────────────

.PHONY: podman-up
podman-up:
	podman-compose --env-file $(ENV_FILE) up --build

.PHONY: podman-start
podman-start:
	podman-compose --env-file $(ENV_FILE) up --build -d

.PHONY: podman-stop
podman-stop:
	podman-compose --env-file $(ENV_FILE) down

.PHONY: podman-build
podman-build:
	podman build -t qa-web-app .

# ─── Local dev (no container) ─────────────────────────────────────────────────

.PHONY: dev
dev:
	python -m uvicorn backend.main:app --host 127.0.0.1 --port $(PORT) --reload

.PHONY: frontend-dev
frontend-dev:
	cd frontend && npm run dev

.PHONY: frontend-build
frontend-build:
	cd frontend && npm run build

# ─── Checks ───────────────────────────────────────────────────────────────────

.PHONY: test
test:
	python -m pytest -q

.PHONY: health
health:
	curl -s http://127.0.0.1:$(PORT)/api/health

.PHONY: help
help:
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up       build + run in foreground (docker compose)"
	@echo "  make docker-start    build + run in background (docker compose -d)"
	@echo "  make docker-stop     stop and remove containers"
	@echo "  make docker-build    build image only"
	@echo ""
	@echo "Podman:"
	@echo "  make podman-up       build + run in foreground (podman compose)"
	@echo "  make podman-start    build + run in background (podman compose -d)"
	@echo "  make podman-stop     stop and remove containers"
	@echo "  make podman-build    build image only (podman build)"
	@echo ""
	@echo "Local dev:"
	@echo "  make dev             run backend with --reload (no container)"
	@echo "  make frontend-dev    run Vite dev server"
	@echo "  make frontend-build  build frontend dist/"
	@echo ""
	@echo "Checks:"
	@echo "  make test            run pytest"
	@echo "  make health          curl /api/health"
	@echo ""
	@echo "Variables:"
	@echo "  ENV_FILE=$(ENV_FILE)  (override: make docker-up ENV_FILE=...)"
	@echo "  PORT=$(PORT)                (override: make dev PORT=9090)"
	@echo ""
