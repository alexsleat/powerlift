Packaging your React web app into a self-contained Android app using Capacitor is an excellent route. 

To do this properly, we need to address a key difference between a server and a mobile phone: **Android apps are sandboxed.** You cannot easily open a file explorer and drop a new JSON file into an installed app's directory. 

To solve this, we will use a **hybrid approach**:
1.  **Bundled Defaults:** We will separate your data into JSON files in a `public/data` folder. These are bundled into the APK when you compile.
2.  **Local Storage Persistence:** Once the app loads, it will copy the bundled JSONs into the device's local storage. Any workouts you do, or custom programs you add later, are saved directly to the device.

Here is your complete guide to compiling with Capacitor in VS Code, along with the refactored code.

---

### Phase 1: Directory Structure & Project Setup

You will want to start with a fresh Vite-powered React project, as it integrates perfectly with Capacitor.

1. Open your terminal in VS Code and run:
   ```bash
   npm create vite@latest powerlifting-app -- --template react
   cd powerlifting-app
   npm install
   ```
2. Install Capacitor core and CLI:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   ```
3. Initialize Capacitor:
   ```bash
   npx cap init PowerliftingApp com.yourname.powerlifting
   ```
   *(When prompted, set the "Web asset directory" to `dist`)*

#### Your Required Directory Structure
Create a `data` folder inside your `public` directory. Move your seed data into these files:

```text
powerlifting-app/
├── public/
│   └── data/
│       ├── exercises.json         <-- Paste SEED_EXERCISE_LIBRARY here
│       ├── templates.json         <-- Paste 531 & StrongLifts templates here
│       └── root_schema.json       <-- Paste user profile, maxes, active instances here
├── src/
│   ├── App.jsx                    <-- (Refactored code below)
│   ├── components/                <-- (Move FieldEditor, RestTimer, etc. here if you wish)
│   └── main.jsx
├── capacitor.config.json
├── package.json
└── vite.config.js
```

---

### Phase 2: Refactored `App.jsx` (Capacitor Ready)

This refactored version of your root component removes the hardcoded data. It dynamically fetches the JSON files from the `public` folder on its first run, and then seamlessly syncs all future changes (like completed sessions and new 1RMs) to the device's persistent storage.

```javascript
import { useState, useEffect } from "react";
// (Assume you have imported your UI components: SessionRunner, RootSchemaView, ExerciseLibraryView)

export default function App() {
  const [rootSchema, setRootSchema] = useState(null);
  const [exLib, setExLib] = useState(null);
  const [activeTab, setActiveTab] = useState("session");
  const [loading, setLoading] = useState(true);

  // 1. Initialization & Local Storage Sync
  useEffect(() => {
    async function loadData() {
      try {
        // Check if device already has saved data
        const savedSchema = localStorage.getItem("powerlifting_schema");
        const savedExLib = localStorage.getItem("powerlifting_exlib");

        if (savedSchema && savedExLib) {
          setRootSchema(JSON.parse(savedSchema));
          setExLib(JSON.parse(savedExLib));
          setLoading(false);
          return;
        }

        // If no saved data (First App Launch), fetch bundled JSON files
        const [exercisesRes, templatesRes, schemaRes] = await Promise.all([
          fetch("data/exercises.json"),
          fetch("data/templates.json"),
          fetch("data/root_schema.json")
        ]);

        const exercisesData = await exercisesRes.json();
        const templatesData = await templatesRes.json();
        const schemaData = await schemaRes.json();

        // Merge templates into the root schema dynamically
        schemaData.programme_templates = templatesData;

        setRootSchema(schemaData);
        setExLib(exercisesData);

        // Save to device storage
        localStorage.setItem("powerlifting_schema", JSON.stringify(schemaData));
        localStorage.setItem("powerlifting_exlib", JSON.stringify(exercisesData));
      } catch (error) {
        console.error("Failed to load initial data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Auto-save wrapper for state updates
  function updateSchema(newSchema) {
    setRootSchema(newSchema);
    localStorage.setItem("powerlifting_schema", JSON.stringify(newSchema));
  }

  function updateExLib(newLib) {
    setExLib(newLib);
    localStorage.setItem("powerlifting_exlib", JSON.stringify(newLib));
  }

  // 3. Handle Session Completion (Save to storage)
  function handleSessionComplete({ plan, results, notes }) {
    // ... (Keep your exact handleSessionComplete logic here) ...
    // BUT replace setRootSchema(prev => ...) with the auto-save wrapper:
    
    const updatedSchema = {
      ...rootSchema,
      workout_sessions: [...rootSchema.workout_sessions, session],
      e1rm_log: [...rootSchema.e1rm_log, ...newE1rms],
      programme_instances: newInsts
    };
    
    updateSchema(updatedSchema);
  }

  if (loading) {
    return <div style={{ color: "#fff", padding: "20px" }}>Loading Database...</div>;
  }

  return (
    <div style={/* Your S.app styles */}>
      {/* ... Navigation UI ... */}
      
      <div style={/* Your S.main styles */}>
        {activeTab === "session" && (
          <SessionRunner rootSchema={rootSchema} exLib={exLib} onSessionComplete={handleSessionComplete} />
        )}
        {activeTab === "root" && (
          <RootSchemaView rootSchema={rootSchema} onChange={updateSchema} />
        )}
        {activeTab === "exlib" && (
          <ExerciseLibraryView exLib={exLib} onChange={updateExLib} />
        )}
      </div>
    </div>
  );
}
```

---

### Phase 3: Building & Compiling for Android

Once your code is in place and your JSON files are in `public/data/`, you are ready to compile the app using Capacitor.

1. **Build the React App:**
   This compiles your React code and your `public` JSON files into static assets in the `dist` folder.
   ```bash
   npm run build
   ```

2. **Add the Android Platform:**
   This creates an actual Android Studio project inside your VS Code workspace.
   ```bash
   npx cap add android
   ```

3. **Sync your Code:**
   Every time you update your React code or your bundled JSON files, you must run build and sync to push the changes into the native Android folder.
   ```bash
   npm run build
   npx cap sync
   ```

4. **Compile the APK:**
   To build the final app, you need Android Studio installed. Capacitor can open it directly for you:
   ```bash
   npx cap open android
   ```
   * Once Android Studio opens, let Gradle sync (it may take a few minutes the first time).
   * Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)** in the top menu.
   * Android Studio will generate an `app-debug.apk` file. Move this to your phone and install it.

### Note on Adding New Programs Later
Because mobile filesystems are locked down, if you write a new JSON program 6 months from now, you have two options:
1. **The App Update Method:** Drop the new JSON into your VS Code `public/data` folder, update your React logic to merge it, run `npx cap sync`, and install the new APK over the old one.
2. **The UI Method (Recommended later):** Build a small "Import JSON" button in your `RootSchemaView` component using standard HTML `<input type="file" accept=".json" />`. When clicked on your phone, it opens the Android file picker, reads the JSON, and merges it into your `localStorage`.