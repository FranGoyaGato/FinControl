"""Simulates the production race: N concurrent seed_admin() calls on an empty
users collection with the unique index in place. Before the fix this raised
DuplicateKeyError (crashing FastAPI startup). Run: python manual_seed_race.py
"""
import asyncio
import os
import sys

sys.path.insert(0, '/app/backend')
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

import server  # noqa: E402


async def main():
    email = os.environ['ADMIN_EMAIL'].lower().strip()
    await server.db.users.create_index('email', unique=True)

    # Fresh state: remove the seeded admin so every racer tries to insert.
    await server.db.users.delete_many({'email': email})
    print('users with seed email before race:', await server.db.users.count_documents({'email': email}))

    results = await asyncio.gather(*[server.seed_admin() for _ in range(8)], return_exceptions=True)
    errors = [r for r in results if isinstance(r, Exception)]
    count = await server.db.users.count_documents({'email': email})
    print('exceptions raised:', errors)
    print('users with seed email after race:', count)
    assert not errors, f'seed_admin raised: {errors}'
    assert count == 1, f'expected exactly 1 user, got {count}'
    print('RACE TEST PASS')


asyncio.run(main())
