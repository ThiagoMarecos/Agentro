"""
Script para marcar un usuario como Super Admin de Nexora.
Uso: python make_superadmin.py <email>
"""
import sys
import sqlite3

DB_PATH = "nexora.db"

def main():
    if len(sys.argv) < 2:
        print("Uso: python make_superadmin.py <email>")
        print("\nUsuarios disponibles:")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.execute("SELECT email, full_name, is_superadmin FROM users")
        for row in cursor:
            sa = " [SUPERADMIN]" if row[2] else ""
            print(f"  - {row[0]} ({row[1] or 'Sin nombre'}){sa}")
        conn.close()
        return

    email = sys.argv[1]
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT id, email, full_name FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        print(f"Usuario con email '{email}' no encontrado.")
        conn.close()
        return

    conn.execute("UPDATE users SET is_superadmin = 1 WHERE email = ?", (email,))
    conn.commit()
    conn.close()

    print(f"Usuario '{user[2] or user[1]}' ({email}) ahora es Super Admin.")

if __name__ == "__main__":
    main()
