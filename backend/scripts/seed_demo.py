"""命令行入口：docker compose exec backend python -m scripts.seed_demo

真实逻辑在 app/scripts/seed_demo.py，避免脚本与主链路各自一份业务逻辑。
"""
from app.scripts.seed_demo import main

if __name__ == "__main__":
    main()
