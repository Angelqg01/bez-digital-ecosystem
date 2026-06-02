import re

FILE = 'd:/Documentos D/Documentos Yoe/BeZhas/BeZhas Web/bezhas-web3/frontend/src/pages/LandingPage.jsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
import_str = """import { motion } from 'framer-motion';
import { useSoundEffects } from '../hooks/useSoundEffects';
"""
if "useSoundEffects" not in content:
    content = content.replace("import { useState", import_str + "import { useState")


# 2. Add hook initialization
hook_str = """
    const { playHover, playClick, playBoot } = useSoundEffects();
    useEffect(() => { 
        // Boot sound on initial load for futuristic feel
        try { playBoot(); } catch(e) {}
    }, []);
"""
if "useSoundEffects()" not in content:
    content = content.replace("const LandingPage = () => {\n    const navigate = useNavigate();", "const LandingPage = () => {\n" + hook_str + "    const navigate = useNavigate();")

# 3. Add sounds to buttons (just universally replace <button onClick to include playClick + original onClick)
# Wait, replacing <button onClick={() => is tricky. Let's just do targeted replace for Hero buttons and Ecosystem.
# We can just add onMouseEnter={playHover} onClick={playClick} to class="... button" but that's messy. 
# Better: Just replace all `<button ` with `<button onMouseEnter={playHover} onClick={(e) => { playClick(); }}` but we must preserve original onClicks.
# Let's target specific known strings:

reps = [
    # Login Nav buttons
    (r"onClick=\{\(\) \=\> openModal\('login'\)\}", r"onMouseEnter={playHover} onClick={() => { playClick(); openModal('login'); }}"),
    (r"onClick=\{\(\) \=\> openModal\('register'\)\}", r"onMouseEnter={playHover} onClick={() => { playClick(); openModal('register'); }}"),
    (r"onClick=\{handleWalletLogin\}", r"onMouseEnter={playHover} onClick={(e) => { playClick(); handleWalletLogin(e); }}"),
    
    # Links in Nav
    (r'<a href="#solutions"', r'<a onMouseEnter={playHover} onClick={playClick} href="#solutions"'),
    (r'<a href="#ecosystem"', r'<a onMouseEnter={playHover} onClick={playClick} href="#ecosystem"'),
    (r'<a href="#technology"', r'<a onMouseEnter={playHover} onClick={playClick} href="#technology"'),
    
    # The 3D wrapper for Ecosystem Link tags
    (r'<Link to="/logistics"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/logistics"'),
    (r'<Link to="/oracle"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/oracle"'),
    (r'<Link to="/real-estate"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/real-estate"'),
    (r'<Link to="/dao-page"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/dao-page"'),
    (r'<Link to="/developer-console"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/developer-console"'),
    (r'<Link to="/liquidity"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/liquidity"'),
    (r'<Link to="/be-vip"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/be-vip"'),
    (r'<Link to="/buy-tokens"', r'<motion.div whileHover={{ scale: 1.05, rotateY: 10, rotateX: 5 }} transition={{ type: "spring", stiffness: 300 }}><Link onMouseEnter={playHover} onClick={playClick} to="/buy-tokens"'),
    
    # We must close the nested motion.div for each Link in ecosystem
    (r'</Link>\n                        {/\* Oracle \*/}', r'</Link></motion.div>\n                        {/* Oracle */}'),
    (r'</Link>\n                        {/\* Real Estate \/ RWA \*/}', r'</Link></motion.div>\n                        {/* Real Estate / RWA */}'),
    (r'</Link>\n                        {/\* Dev Console \*/}', r'</Link></motion.div>\n                        {/* Dev Console */}'),
    (r'</Link>\n                        {/\* DAO \*/}', r'</Link></motion.div>\n                        {/* DAO */}'),
    (r'</Link>\n                        {/\* Liquidity \*/}', r'</Link></motion.div>\n                        {/* Liquidity */}'),
    (r'</Link>\n                        {/\* VIP \*/}', r'</Link></motion.div>\n                        {/* VIP */}'),
    (r'</Link>\n                        {/\* Buy Tokens \*/}', r'</Link></motion.div>\n                        {/* Buy Tokens */}'),
    (r'</Link>\n                    </div>\n\n                    {/\* Secondary', r'</Link></motion.div>\n                    </div>\n\n                    {/* Secondary'),
]

for old, new_ in reps:
    # Need to be careful. I'll use simple string replace where possible, or regex mapping.
    content = re.sub(old, new_, content)


with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied 3D and sounds")
