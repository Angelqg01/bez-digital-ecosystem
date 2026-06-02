import re

# El contenido correcto de los imports
correct_imports = """import React, { useState, useEffect, useRef, useCallback } from 'react';

import { useAccount } from 'wagmi';

import { useNavigate } from 'react-router-dom';

import {
    Send, Bot, Users, Building2, MessageSquare, Search, Phone, Video,
    MoreVertical, Paperclip, Smile, X, Plus, User, Check, CheckCheck,
    Hash, Lock, Globe, Star, Settings, ArrowLeft, Loader2, Menu, Reply, ThumbsUp, Heart, Laugh
} from 'lucide-react';

import { toast } from 'react-hot-toast';

import axios from 'axios';

import Spinner from '../components/Spinner';
"""

# Leer el archivo completo
with open('ChatPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Encontrar donde terminan los imports (buscar "const ChatPage")
match = re.search(r'(const ChatPage.*)', content, re.DOTALL)
if match:
    rest_of_file = match.group(1)
    
    # Reconstruir el archivo con los imports correctos
    new_content = correct_imports + "\n\n" + rest_of_file
    
    # Escribir el archivo corregido
    with open('ChatPage.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("Archivo corregido exitosamente")
else:
    print("No se encontró 'const ChatPage'")
