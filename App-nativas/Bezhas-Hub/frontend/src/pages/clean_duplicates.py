import re

# Leer el archivo
with open('ChatPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

cleaned_lines = []

for line in lines:
    original_line = line.rstrip('\n')
    
    # Si la línea tiene un patrón duplicado exacto tipo "texto; texto;"
    # donde texto es idéntico
    if '; const ' in original_line:
        # Buscar duplicación del tipo "const X = Y; const X = Y;"
        parts = original_line.split('; const ')
        if len(parts) == 2:
            # Tomar solo la primera parte y agregar el punto y coma
            cleaned_line = parts[0] + ';'
            cleaned_lines.append(cleaned_line + '\n')
            continue
    
    # Para cualquier otra línea, mantenerla como está
    cleaned_lines.append(line)

# Escribir el archivo limpio
with open('ChatPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(cleaned_lines)

print(f"Limpieza completada. Líneas procesadas: {len(lines)}")
