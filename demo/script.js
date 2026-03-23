const API_BASE = '/api';
let currentThemeId = null;
let currentSchema = null;
let themes = [];

// Load available themes on page load
async function loadThemes() {
  try {
    const response = await fetch(`${API_BASE}/themes`);
    themes = await response.json();

    const select = document.getElementById('theme-select');
    select.innerHTML = themes.length > 0
      ? themes.map(t => `<option value="${t.id}">${t.name}</option>`).join('')
      : '<option value="">No themes available</option>';

    if (themes.length > 0) {
      currentThemeId = themes[0].id;
      loadTheme();
    }
  } catch (error) {
    showStatus('Failed to load themes: ' + error.message, 'error');
  }
}

// Load and apply a theme's CSS
async function loadTheme() {
  const select = document.getElementById('theme-select');
  currentThemeId = select.value;

  if (!currentThemeId) return;

  try {
    // Fetch the rendered CSS
    const cssResponse = await fetch(`${API_BASE}/render/${currentThemeId}.css`);
    const css = await cssResponse.text();

    // Apply the CSS
    document.getElementById('theme-styles').textContent = css;

    const theme = themes.find(t => t.id === currentThemeId);
    showStatus(`Theme "${theme?.name || currentThemeId}" applied successfully!`, 'success');

    // Load theme details for editing if editor is open
    if (document.getElementById('editor-container').style.display !== 'none') {
      await loadThemeForEditing();
    }
  } catch (error) {
    showStatus('Failed to load theme: ' + error.message, 'error');
  }
}

// Load theme and schema for editing
async function loadThemeForEditing() {
  if (!currentThemeId) return;

  try {
    document.getElementById('editor-loading').style.display = 'block';
    document.getElementById('theme-form').style.display = 'none';

    // Fetch theme details
    const themeResponse = await fetch(`${API_BASE}/themes/${currentThemeId}`);
    const theme = await themeResponse.json();

    // Fetch schema if theme has one
    if (theme.schemaId) {
      const schemaResponse = await fetch(`${API_BASE}/schemas/${theme.schemaId}`);
      currentSchema = await schemaResponse.json();
    } else {
      // For freeform themes, create a pseudo-schema from existing variables
      currentSchema = {
        name: 'Freeform',
        variables: {}
      };
      for (const [name, variable] of Object.entries(theme.variables)) {
        currentSchema.variables[name] = {
          description: '',
          allowedTypes: [variable.type || 'string'],
          defaultType: variable.type || 'string',
          defaultValue: variable.value
        };
      }
    }

    // Build the form
    buildThemeForm(theme, currentSchema);

    document.getElementById('editor-loading').style.display = 'none';
    document.getElementById('theme-form').style.display = 'block';
  } catch (error) {
    showStatus('Failed to load theme for editing: ' + error.message, 'error');
  }
}

// Build dynamic form based on schema
function buildThemeForm(theme, schema) {
  const formFields = document.getElementById('form-fields');
  formFields.innerHTML = '';

  for (const [varName, varDef] of Object.entries(schema.variables)) {
    const currentValue = theme.variables[varName]?.value || varDef.defaultValue;
    const currentType = theme.variables[varName]?.type || varDef.defaultType;
    const allowedTypes = varDef.allowedTypes || [varDef.defaultType || 'string'];

    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.textContent = varName;
    formGroup.appendChild(label);

    if (varDef.description) {
      const description = document.createElement('small');
      description.textContent = varDef.description;
      formGroup.appendChild(description);
    }

    // Check if this field supports multiple types (gradient + color)
    const supportsMultipleTypes = allowedTypes.includes('gradient') && allowedTypes.includes('color');

    if (supportsMultipleTypes) {
      // Determine current mode from value
      const isGradient = currentValue.includes('gradient');

      // Type selector
      const typeSelector = document.createElement('div');
      typeSelector.style.marginBottom = '0.5rem';

      const gradientRadio = document.createElement('input');
      gradientRadio.type = 'radio';
      gradientRadio.name = `${varName}-type`;
      gradientRadio.value = 'gradient';
      gradientRadio.id = `${varName}-gradient`;
      gradientRadio.checked = isGradient;

      const gradientLabel = document.createElement('label');
      gradientLabel.htmlFor = `${varName}-gradient`;
      gradientLabel.textContent = ' Gradient';
      gradientLabel.style.marginRight = '1rem';
      gradientLabel.style.cursor = 'pointer';

      const colorRadio = document.createElement('input');
      colorRadio.type = 'radio';
      colorRadio.name = `${varName}-type`;
      colorRadio.value = 'color';
      colorRadio.id = `${varName}-color`;
      colorRadio.checked = !isGradient;

      const colorLabel = document.createElement('label');
      colorLabel.htmlFor = `${varName}-color`;
      colorLabel.textContent = ' Solid Color';
      colorLabel.style.cursor = 'pointer';

      typeSelector.appendChild(gradientRadio);
      typeSelector.appendChild(gradientLabel);
      typeSelector.appendChild(colorRadio);
      typeSelector.appendChild(colorLabel);
      formGroup.appendChild(typeSelector);

      // Gradient controls
      const gradientControls = document.createElement('div');
      gradientControls.id = `${varName}-gradient-controls`;
      gradientControls.style.display = isGradient ? 'block' : 'none';

      const match = currentValue.match(/linear-gradient\([^,]+,\s*([#\w]+)\s+[\d.]+%,\s*([#\w]+)\s+[\d.]+%\)/);
      const color1 = match ? match[1] : '#3b82f6';
      const color2 = match ? match[2] : '#8b5cf6';

      const gradientDiv = document.createElement('div');
      gradientDiv.className = 'gradient-inputs';

      const input1Div = document.createElement('div');
      const input1Label = document.createElement('label');
      input1Label.textContent = 'Start Color';
      input1Label.style.fontSize = '0.875rem';
      const input1 = document.createElement('input');
      input1.type = 'color';
      input1.name = `${varName}-start`;
      input1.value = color1;
      input1Div.appendChild(input1Label);
      input1Div.appendChild(input1);

      const input2Div = document.createElement('div');
      const input2Label = document.createElement('label');
      input2Label.textContent = 'End Color';
      input2Label.style.fontSize = '0.875rem';
      const input2 = document.createElement('input');
      input2.type = 'color';
      input2.name = `${varName}-end`;
      input2.value = color2;
      input2Div.appendChild(input2Label);
      input2Div.appendChild(input2);

      gradientDiv.appendChild(input1Div);
      gradientDiv.appendChild(input2Div);
      gradientControls.appendChild(gradientDiv);

      const gradientPreview = document.createElement('div');
      gradientPreview.className = 'gradient-preview';
      gradientPreview.style.background = isGradient ? currentValue : `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
      gradientControls.appendChild(gradientPreview);

      const updateGradientPreview = () => {
        const gradient = `linear-gradient(135deg, ${input1.value} 0%, ${input2.value} 100%)`;
        gradientPreview.style.background = gradient;
      };
      input1.addEventListener('input', updateGradientPreview);
      input2.addEventListener('input', updateGradientPreview);

      formGroup.appendChild(gradientControls);

      // Color controls
      const colorControls = document.createElement('div');
      colorControls.id = `${varName}-color-controls`;
      colorControls.style.display = !isGradient ? 'block' : 'none';

      const solidColorValue = !isGradient ? currentValue : '#3b82f6';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.name = `${varName}-solid`;
      colorInput.value = solidColorValue;
      colorControls.appendChild(colorInput);

      const colorTextInput = document.createElement('input');
      colorTextInput.type = 'text';
      colorTextInput.value = solidColorValue;
      colorTextInput.style.marginTop = '0.5rem';
      colorTextInput.addEventListener('input', (e) => {
        if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
          colorInput.value = e.target.value;
        }
      });
      colorInput.addEventListener('input', (e) => {
        colorTextInput.value = e.target.value;
      });
      colorControls.appendChild(colorTextInput);

      formGroup.appendChild(colorControls);

      // Toggle between gradient and color
      gradientRadio.addEventListener('change', () => {
        gradientControls.style.display = 'block';
        colorControls.style.display = 'none';
      });
      colorRadio.addEventListener('change', () => {
        gradientControls.style.display = 'none';
        colorControls.style.display = 'block';
      });

    } else if (allowedTypes.includes('color')) {
      const input = document.createElement('input');
      input.type = 'color';
      input.name = varName;
      input.value = currentValue;
      formGroup.appendChild(input);

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.value = currentValue;
      textInput.style.marginTop = '0.5rem';
      textInput.addEventListener('input', (e) => {
        if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/)) {
          input.value = e.target.value;
        }
      });
      input.addEventListener('input', (e) => {
        textInput.value = e.target.value;
      });
      formGroup.appendChild(textInput);

    } else if (allowedTypes.includes('gradient')) {
      // Parse gradient for two-color linear gradient
      const match = currentValue.match(/linear-gradient\([^,]+,\s*([#\w]+)\s+[\d.]+%,\s*([#\w]+)\s+[\d.]+%\)/);
      const color1 = match ? match[1] : '#3b82f6';
      const color2 = match ? match[2] : '#8b5cf6';

      const gradientDiv = document.createElement('div');
      gradientDiv.className = 'gradient-inputs';

      const input1Div = document.createElement('div');
      const input1Label = document.createElement('label');
      input1Label.textContent = 'Start Color';
      input1Label.style.fontSize = '0.875rem';
      const input1 = document.createElement('input');
      input1.type = 'color';
      input1.name = `${varName}-start`;
      input1.value = color1;
      input1Div.appendChild(input1Label);
      input1Div.appendChild(input1);

      const input2Div = document.createElement('div');
      const input2Label = document.createElement('label');
      input2Label.textContent = 'End Color';
      input2Label.style.fontSize = '0.875rem';
      const input2 = document.createElement('input');
      input2.type = 'color';
      input2.name = `${varName}-end`;
      input2.value = color2;
      input2Div.appendChild(input2Label);
      input2Div.appendChild(input2);

      gradientDiv.appendChild(input1Div);
      gradientDiv.appendChild(input2Div);
      formGroup.appendChild(gradientDiv);

      // Preview
      const preview = document.createElement('div');
      preview.className = 'gradient-preview';
      preview.style.background = currentValue;
      formGroup.appendChild(preview);

      const updatePreview = () => {
        const gradient = `linear-gradient(135deg, ${input1.value} 0%, ${input2.value} 100%)`;
        preview.style.background = gradient;
      };
      input1.addEventListener('input', updatePreview);
      input2.addEventListener('input', updatePreview);

    } else {
      // String type
      const input = document.createElement('input');
      input.type = 'text';
      input.name = varName;
      input.value = currentValue;
      formGroup.appendChild(input);
    }

    formFields.appendChild(formGroup);
  }
}

// Handle form submission
document.getElementById('theme-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const updates = {};

  // Build updates object
  for (const [varName, varDef] of Object.entries(currentSchema.variables)) {
    const allowedTypes = varDef.allowedTypes || [varDef.defaultType || 'string'];
    const supportsMultipleTypes = allowedTypes.includes('gradient') && allowedTypes.includes('color');

    let value;
    let type;

    if (supportsMultipleTypes) {
      // Check which type was selected
      const selectedType = formData.get(`${varName}-type`);
      type = selectedType || 'gradient';

      if (selectedType === 'gradient') {
        const startColor = formData.get(`${varName}-start`);
        const endColor = formData.get(`${varName}-end`);
        value = `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`;
      } else {
        value = formData.get(`${varName}-solid`);
      }
    } else if (allowedTypes.includes('gradient')) {
      type = 'gradient';
      const startColor = formData.get(`${varName}-start`);
      const endColor = formData.get(`${varName}-end`);
      value = `linear-gradient(135deg, ${startColor} 0%, ${endColor} 100%)`;
    } else {
      type = allowedTypes[0] || 'string';
      value = formData.get(varName);
    }

    // Only include if changed or required
    if (value) {
      updates[varName] = { value, type };
    }
  }

  // Save each variable
  try {
    for (const [varName, varData] of Object.entries(updates)) {
      await fetch(`${API_BASE}/themes/${currentThemeId}/variables/${varName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(varData)
      });
    }

    showStatus('Theme updated successfully!', 'success');

    // Reload the theme to see changes
    await loadTheme();
  } catch (error) {
    showStatus('Failed to save theme: ' + error.message, 'error');
  }
});

// Toggle editor visibility
function toggleEditor() {
  const editor = document.getElementById('editor-container');
  if (editor.style.display === 'none') {
    editor.style.display = 'block';
    if (currentThemeId) {
      loadThemeForEditing();
    }
  } else {
    editor.style.display = 'none';
  }
}

// Show status message
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status-message ${type}`;

  setTimeout(() => {
    status.textContent = '';
    status.className = '';
  }, 5000);
}

// Initialize
loadThemes();