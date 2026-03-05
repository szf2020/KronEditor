import json
import os

locales_dir = '/home/fehim/Documents/KronEditor/src/locales'

additions = {
    'en': {
        'logs': {
            'systemInitialized': 'System initialized.',
            'systemReady': 'Ready to map PLC project...',
            'simulationStatus': 'Simulation status: {{status}}.',
            'simulationError': 'Simulation Error: {{error}}',
            'projectSaved': 'Project saved to {{path}}',
            'saveError': 'Save Error: {{error}}',
            'saveAsError': 'Save As Error: {{error}}',
            'startedNewProject': 'Started new project.',
            'confirmCloseProject': 'Are you sure you want to close the current project? Any unsaved changes will be lost.',
            'missingConfigRestored': 'Project had no configuration; restored default.',
            'projectLoaded': 'Project loaded from {{path}}',
            'invalidFormat': 'Failed to parse project file (Invalid Format).',
            'openError': 'Open Error: {{error}}',
            'cannotSimulateConnected': 'Cannot enable Simulation Mode while PLC is connected.',
            'stopExecutionFirst': 'Please stop execution before toggling simulation mode.',
            'compilingSimulationTranspile': 'Compiling Project for Simulation (C Transpilation)...',
            'transpiledSaved': 'Transpiled C header and source successfully saved to {{path}}',
            'compilingSimulationGcc': 'Compiling simulation executable with gcc (debug symbols)...',
            'simulationCompiled': 'Simulation executable compiled: {{path}}',
            'simulationEnabled': 'Simulation Mode Enabled. Variables populated with default values.',
            'simulationCompileFailed': 'Simulation Compilation Failed: {{error}}',
            'simulationDisabled': 'Simulation Mode Disabled.',
            'cannotStartEnableSim': 'Cannot start. Please enable Simulation Mode or connect to a PLC.',
            'failedToStartSim': 'Failed to start simulation: {{error}}',
            'plcExecutionStarted': 'PLC Execution Started.',
            'failedToStopSim': 'Failed to stop simulation: {{error}}',
            'forceWriteFailed': "Force write failed for '{{key}}': {{error}}",
            'buildStartedTarget': 'Build started for target: {{target}}...',
            'projectBuilt': 'Project built successfully.',
            'buildFailed': 'Build failed: {{error}}',
            'sendToPlcTriggered': 'Send to PLC triggered for target: {{target}}',
            'binarySentSimulated': 'Binary sent to PLC (Simulated Action)',
            'addedDataType': 'Added Data Type {{name}} ({{type}})',
            'duplicateName': 'An item with this name already exists.',
            'updatedProperties': 'Updated properties for {{name}}',
            'addedItem': 'Added {{name}} ({{type}}) to {{category}}',
            'deletedItem': 'Deleted item {{id}}',
            'renamedItem': 'Renamed item to {{name}}'
        },
        'errors': {
            "varExistsScope": "Variable name '{{name}}' already exists in this scope!",
            "varExistsOtherScope": "Variable name '{{name}}' already exists as a local variable in another program/block!",
            "varExistsWithType": "Variable with name '{{name}}' and type '{{type}}' already exists!"
        },
        'messages': {
            "confirmDelete": "Delete {{name}}?",
            "confirmCloseProject": "Are you sure you want to close the current project? Any unsaved changes will be lost."
        }
    },
    'tr': {
        'logs': {
            'systemInitialized': 'Sistem başlatıldı.',
            'systemReady': 'PLC projesi eşlenmeye hazır...',
            'simulationStatus': 'Simülasyon durumu: {{status}}.',
            'simulationError': 'Simülasyon Hatası: {{error}}',
            'projectSaved': 'Proje kaydedildi: {{path}}',
            'saveError': 'Kaydetme Hatası: {{error}}',
            'saveAsError': 'Farklı Kaydetme Hatası: {{error}}',
            'startedNewProject': 'Yeni proje başlatıldı.',
            'confirmCloseProject': 'Mevcut projeyi kapatmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolacak.',
            'missingConfigRestored': 'Projenin yapılandırması yoktu; varsayılan geri yüklendi.',
            'projectLoaded': 'Proje yüklendi: {{path}}',
            'invalidFormat': 'Proje dosyası ayrıştırılamadı (Geçersiz Format).',
            'openError': 'Açma Hatası: {{error}}',
            'cannotSimulateConnected': 'PLC bağlıyken Simülasyon Modu etkinleştirilemez.',
            'stopExecutionFirst': 'Simülasyon modunu değiştirmeden önce lütfen yürütmeyi durdurun.',
            'compilingSimulationTranspile': 'Simülasyon için Proje Derleniyor (C Transpilation)...',
            'transpiledSaved': 'Çevrilen C başlık ve kaynak dosyası başarıyla kaydedildi: {{path}}',
            'compilingSimulationGcc': 'Simülasyon çalıştırılabilir dosyası gcc ile derleniyor (hata ayıklama sembolleriyle)...',
            'simulationCompiled': 'Simülasyon dosyası derlendi: {{path}}',
            'simulationEnabled': 'Simülasyon Modu Etkinleştirildi. Değişkenler varsayılan değerler ile dolduruldu.',
            'simulationCompileFailed': 'Simülasyon Derleme Hatası: {{error}}',
            'simulationDisabled': 'Simülasyon Modu Devre Dışı Bırakıldı.',
            'cannotStartEnableSim': "Başlatılamıyor. Lütfen Simülasyon Modunu etkinleştirin veya bir PLC'ye bağlanın.",
            'failedToStartSim': 'Simülasyon başlatılamadı: {{error}}',
            'plcExecutionStarted': 'PLC Yürütmesi Başlatıldı.',
            'failedToStopSim': 'Simülasyon durdurulamadı: {{error}}',
            'forceWriteFailed': "\"{{key}}\" için zorunlu yazma işlemi başarısız oldu: {{error}}",
            'buildStartedTarget': 'Hedef için derleme başlatıldı: {{target}}...',
            'projectBuilt': 'Proje başarıyla derlendi.',
            'buildFailed': 'Derleme başarısız oldu: {{error}}',
            'sendToPlcTriggered': "Hedef için PLC'ye gönderme tetiklendi: {{target}}",
            'binarySentSimulated': "Elde edilen kod PLC'ye gönderildi (Simüle Edilen İşlem)",
            'addedDataType': 'Veri Tipi Eklendi: {{name}} ({{type}})',
            'duplicateName': 'Bu isimde bir öğe zaten mevcut.',
            'updatedProperties': 'Özellikler güncellendi: {{name}}',
            'addedItem': '{{name}} ({{type}}), {{category}} kategorisine eklendi',
            'deletedItem': 'Öğe {{id}} silindi',
            'renamedItem': 'Öğe {{name}} olarak yeniden adlandırıldı'
        },
        'errors': {
            "varExistsScope": "Değişken adı '{{name}}' bu kapsamda zaten mevcut!",
            "varExistsOtherScope": "Değişken adı '{{name}}' başka bir programda/blokta yerel değişken olarak zaten mevcut!",
            "varExistsWithType": "'{{name}}' adında ve '{{type}}' tipinde değişken zaten mevcut!"
        },
        'messages': {
            "confirmDelete": "{{name}} öğesi silinsin mi?",
            "confirmCloseProject": "Mevcut projeyi kapatmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler kaybolacak."
        }
    },
    'ru': {
        'logs': {
            'systemInitialized': 'Система инициализирована.',
            'systemReady': 'Готов к сопоставлению проекта ПЛК...',
            'simulationStatus': 'Статус симуляции: {{status}}.',
            'simulationError': 'Ошибка симуляции: {{error}}',
            'projectSaved': 'Проект сохранен в {{path}}',
            'saveError': 'Ошибка сохранения: {{error}}',
            'saveAsError': 'Ошибка сохранения как: {{error}}',
            'startedNewProject': 'Начат новый проект.',
            'confirmCloseProject': 'Вы уверены, что хотите закрыть текущий проект? Любые несохраненные изменения будут потеряны.',
            'missingConfigRestored': 'У проекта не было конфигурации; восстановлены настройки по умолчанию.',
            'projectLoaded': 'Проект загружен из {{path}}',
            'invalidFormat': 'Не удалось разобрать файл проекта (Неверный формат).',
            'openError': 'Ошибка открытия: {{error}}',
            'cannotSimulateConnected': 'Невозможно включить режим симуляции при подключенном ПЛК.',
            'stopExecutionFirst': 'Пожалуйста, остановите выполнение перед переключением режима симуляции.',
            'compilingSimulationTranspile': 'Компиляция проекта для симуляции (C Transpilation)...',
            'transpiledSaved': 'Транспилированный заголовок и исходный код C успешно сохранены в {{path}}',
            'compilingSimulationGcc': 'Компиляция исполняемого файла симуляции с gcc (с отладочными символами)...',
            'simulationCompiled': 'Исполняемый файл симуляции скомпилирован: {{path}}',
            'simulationEnabled': 'Режим симуляции включен. Переменные заполнены значениями по умолчанию.',
            'simulationCompileFailed': 'Ошибка компиляции симуляции: {{error}}',
            'simulationDisabled': 'Режим симуляции отключен.',
            'cannotStartEnableSim': 'Не удалось запустить. Пожалуйста, включите режим симуляции или подключитесь к ПЛК.',
            'failedToStartSim': 'Не удалось запустить симуляцию: {{error}}',
            'plcExecutionStarted': 'Выполнение ПЛК начато.',
            'failedToStopSim': 'Не удалось остановить симуляцию: {{error}}',
            'forceWriteFailed': "Принудительная запись не удалась для '{{key}}': {{error}}",
            'buildStartedTarget': 'Сборка начата для цели: {{target}}...',
            'projectBuilt': 'Проект успешно собран.',
            'buildFailed': 'Ошибка сборки: {{error}}',
            'sendToPlcTriggered': 'Отправка в ПЛК инициирована для цели: {{target}}',
            'binarySentSimulated': 'Бинарный файл отправлен в ПЛК (Симулированное действие)',
            'addedDataType': 'Добавлен тип данных {{name}} ({{type}})',
            'duplicateName': 'Элемент с таким именем уже существует.',
            'updatedProperties': 'Обновлены свойства для {{name}}',
            'addedItem': 'Добавлен {{name}} ({{type}}) в {{category}}',
            'deletedItem': 'Удален элемент {{id}}',
            'renamedItem': 'Элемент переименован в {{name}}'
        },
        'errors': {
            "varExistsScope": "Имя переменной '{{name}}' уже существует в этой области видимости!",
            "varExistsOtherScope": "Имя переменной '{{name}}' уже существует как локальная переменная в другой программе/блоке!",
            "varExistsWithType": "Переменная с именем '{{name}}' и типом '{{type}}' уже существует!",
            "invalidIdentifier": "Недопустимый идентификатор: \"{{name}}\". Должен начинаться с буквы/подчеркивания и содержать только буквенно-цифровые символы.",
            "nameRequired": "Имя обязательно",
            "nameExists": "Имя уже существует"
        },
        'messages': {
            "confirmDelete": "Удалить {{name}}?",
            "confirmCloseProject": "Вы уверены, что хотите закрыть текущий проект? Любые несохраненные изменения будут потеряны.",
            "arrayDef": "Определение массива",
            "arrayDesc": "Определите размеры и базовый тип вашего массива.",
            "structDef": "Определение структуры",
            "structDesc": "Определите члены вашей структуры.",
            "enumDef": "Определение перечисления",
            "enumDesc": "Определите перечисляемые значения.",
            "noMembers": "Члены не определены. Нажмите \"Добавить член\", чтобы начать.",
            "structTip": "Совет: Нажмите Enter в последнем поле значения по умолчанию, чтобы добавить новую строку."
        }
    }
}

for lang, data in additions.items():
    file_path = os.path.join(locales_dir, f'{lang}.json')
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            current = json.load(f)
        
        # Merge dicts
        for key, val in data.items():
            if key not in current:
                current[key] = {}
            if isinstance(val, dict):
                for k, v in val.items():
                    current[key][k] = v
            else:
                current[key] = val
                
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(current, f, indent=4, ensure_ascii=False)
        print(f"Updated {lang}.json")
