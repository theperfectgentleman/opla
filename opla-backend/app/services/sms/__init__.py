"""Outbound SMS for project broadcasts (Messages → Broadcasts).

Pure helpers (phone, segments, contacts) have no DB or network access so they
can be unit tested directly. Providers live in ``providers.py``.
"""
