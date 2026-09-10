/* Interface-only localization. Catalog values, file contents and AI replies are never translated. */
(() => {
  const messages = [
    ['No description yet.', 'Pas encore de description.', 'Todavía no hay descripción.'],
    ['Not set', 'Non renseigné', 'Sin especificar'],
    ['No notes yet.', 'Pas encore de notes.', 'Todavía no hay notas.'],
    ['Needs review', 'À vérifier', 'Pendiente de revisión'],
    ['Ready', 'Prêt', 'Listo'],
    ['Imported from Google Sheet', 'Importé de Google Sheets', 'Importado de Google Sheets'],
    ['Web link', 'Lien web', 'Enlace web'],
    ['Managed file copy', 'Copie gérée du fichier', 'Copia gestionada del archivo'],
    ['Referenced file', 'Fichier référencé', 'Archivo referenciado'],
    ['Resource preview', 'Aperçu de la ressource', 'Vista previa del recurso'],
    ['Preview helper', 'Aide à l’aperçu', 'Ayuda de vista previa'],
    ['Share package created.', 'Dossier de partage créé.', 'Paquete para compartir creado.'],
    ['Share package created with its file.', 'Dossier de partage créé avec le fichier.', 'Paquete para compartir creado con su archivo.'],
    ['Could not detect; check space before downloading.', 'Détection impossible ; vérifiez l’espace avant le téléchargement.', 'No se ha podido detectar; comprueba el espacio antes de descargar.'],
    ['Not reported', 'Non signalé', 'No indicado'],
    ['Not available', 'Indisponible', 'No disponible'],
    ['Your professional library', 'Votre bibliothèque professionnelle', 'Tu biblioteca profesional'],
    ['Library', 'Bibliothèque', 'Biblioteca'],
    ['Categories', 'Catégories', 'Categorías'],
    ['Languages', 'Langues', 'Idiomas'],
    ['Local & private', 'Local et privé', 'Local y privado'],
    ['Cloud backup not set', 'Sauvegarde cloud non configurée', 'Copia en la nube sin configurar'],
    ['Agent & backup settings', 'Paramètres agent et sauvegarde', 'Ajustes de agente y copias'],
    ['Add link', 'Ajouter un lien', 'Añadir enlace'],
    ['＋ Add files', '＋ Ajouter des fichiers', '＋ Añadir archivos'],
    ['All resources', 'Toutes les ressources', 'Todos los recursos'],
    ['Your knowledge, in one place', 'Vos connaissances, réunies', 'Tu conocimiento, en un solo lugar'],
    ['Recently updated', 'Modifications récentes', 'Actualizados recientemente'],
    ['Highest rated', 'Les mieux notés', 'Mejor valorados'],
    ['Newest publication', 'Publications récentes', 'Publicación más reciente'],
    ['Title A–Z', 'Titre A–Z', 'Título A–Z'],
    ['Author A–Z', 'Auteur A–Z', 'Autor A–Z'],
    ['No matching resources', 'Aucune ressource correspondante', 'No hay recursos coincidentes'],
    ['Try a different search or add a file or link.', 'Essayez une autre recherche ou ajoutez un fichier ou un lien.', 'Prueba otra búsqueda o añade un archivo o enlace.'],
    ['Details', 'Détails', 'Detalles'],
    ['Ask library', 'Interroger la bibliothèque', 'Consultar la biblioteca'],
    ['Library agent', 'Agent de bibliothèque', 'Agente de biblioteca'],
    ['Checking local model…', 'Vérification du modèle local…', 'Comprobando modelo local…'],
    ['Ask about themes, authors, languages, or which resource might fit a topic.', 'Posez une question sur les thèmes, auteurs, langues ou les ressources adaptées à un sujet.', 'Pregunta sobre temas, autores, idiomas o recursos adecuados para un tema.'],
    ['More info', 'Plus d’informations', 'Más información'],
    ['Request correction', 'Demander une correction', 'Solicitar corrección'],
    ['Preview / open', 'Aperçu / ouvrir', 'Vista previa / abrir'],
    ['Preview', 'Aperçu', 'Vista previa'],
    ['Delete from database…', 'Supprimer de la base…', 'Eliminar de la base de datos…'],
    ['Delete this library entry?', 'Supprimer cette entrée ?', '¿Eliminar esta entrada de la biblioteca?'],
    ['Only the database entry will be deleted. Original files and managed copies will stay on your computer.', 'Seule l’entrée de la base sera supprimée. Les fichiers originaux et les copies resteront sur votre ordinateur.', 'Solo se eliminará la entrada de la base de datos. Los archivos originales y las copias permanecerán en tu ordenador.'],
    ['Cancel', 'Annuler', 'Cancelar'],
    ['Confirm deletion', 'Confirmer la suppression', 'Confirmar eliminación'],
    ['Close', 'Fermer', 'Cerrar'],
    ['Send', 'Envoyer', 'Enviar'],
    ['Close setup', 'Fermer la configuration', 'Cerrar configuración'],
    ['How should PsyShelf store these files?', 'Comment conserver ces fichiers ?', '¿Cómo debe guardar PsyShelf estos archivos?'],
    ['You can decide each time you import. Both options keep the entry in your database.', 'Vous choisissez à chaque importation. Les deux options conservent l’entrée dans votre base.', 'Puedes elegir en cada importación. Ambas opciones guardan la entrada en tu base de datos.'],
    ['Reference original files', 'Référencer les originaux', 'Referenciar archivos originales'],
    ['Uses no extra storage. Moving the originals may break the link.', 'Aucun stockage supplémentaire. Déplacer les originaux peut rompre le lien.', 'No ocupa espacio adicional. Mover los originales puede romper el enlace.'],
    ['Copy into PsyShelf', 'Copier dans PsyShelf', 'Copiar en PsyShelf'],
    ['Safer and included in cloud backups, but uses additional disk space.', 'Inclus dans les sauvegardes cloud, mais utilise plus d’espace disque.', 'Se incluye en las copias en la nube, pero ocupa espacio adicional.'],
    ['New web resource', 'Nouvelle ressource web', 'Nuevo recurso web'],
    ['Add a link', 'Ajouter un lien', 'Añadir un enlace'],
    ['Title', 'Titre', 'Título'],
    ['Author', 'Auteur', 'Autor'],
    ['Authors', 'Auteurs', 'Autores'],
    ['Short description', 'Description courte', 'Descripción breve'],
    ['Add resource', 'Ajouter la ressource', 'Añadir recurso'],
    ['Correction review', 'Examen de la correction', 'Revisión de corrección'],
    ['Request a metadata change', 'Demander une modification des métadonnées', 'Solicitar un cambio de metadatos'],
    ['The local correction agent will check your proposal. You always keep the final override.', 'L’agent local examine votre proposition. Vous gardez toujours le dernier mot.', 'El agente local revisará tu propuesta. Siempre tendrás la decisión final.'],
    ['Description', 'Description', 'Descripción'],
    ['Why should this change?', 'Pourquoi modifier ces informations ?', '¿Por qué debe cambiar?'],
    ['Ask agent to review', 'Demander à l’agent de vérifier', 'Pedir revisión al agente'],
    ['Configuration', 'Configuration', 'Configuración'],
    ['Agent & backup', 'Agent et sauvegarde', 'Agente y copias de seguridad'],
    ['Interface language', 'Langue de l’interface', 'Idioma de la interfaz'],
    ['Changes the interface language. Your resource content stays unchanged.', 'Modifie la langue de l’interface. Le contenu de vos ressources reste inchangé.', 'Cambia el idioma de la interfaz. El contenido de tus recursos no cambia.'],
    ['Free local intelligence', 'IA locale gratuite', 'Inteligencia local gratuita'],
    ['Checking Ollama…', 'Vérification d’Ollama…', 'Comprobando Ollama…'],
    ['PsyShelf uses Ollama only on your computer. Find a local model suited to this computer with the setup assistant.', 'PsyShelf utilise Ollama uniquement sur votre ordinateur. L’assistant propose un modèle local adapté.', 'PsyShelf utiliza Ollama solo en tu ordenador. El asistente recomienda un modelo local adecuado.'],
    ['Check computer & set up agent', 'Vérifier l’ordinateur et configurer l’agent', 'Comprobar equipo y configurar agente'],
    ['Model', 'Modèle', 'Modelo'],
    ['Copy', 'Copier', 'Copiar'],
    ['Get Ollama for Windows', 'Obtenir Ollama pour Windows', 'Obtener Ollama para Windows'],
    ['Save model', 'Enregistrer le modèle', 'Guardar modelo'],
    ['Google Drive / cloud backup', 'Google Drive / sauvegarde cloud', 'Google Drive / copia en la nube'],
    ['Not configured', 'Non configuré', 'Sin configurar'],
    ['Choose a folder already synchronized by Google Drive for Desktop, OneDrive, or another provider. PsyShelf will place an updated database copy and managed files there.', 'Choisissez un dossier déjà synchronisé par Google Drive, OneDrive ou un autre service. PsyShelf y copiera la base à jour et les fichiers gérés.', 'Elige una carpeta ya sincronizada por Google Drive, OneDrive u otro servicio. PsyShelf guardará allí una copia actualizada de la base y los archivos gestionados.'],
    ['Choose folder', 'Choisir un dossier', 'Elegir carpeta'],
    ['Back up now', 'Sauvegarder maintenant', 'Crear copia ahora'],
    ['Resource details & personal notes', 'Détails de la ressource et notes personnelles', 'Detalles del recurso y notas personales'],
    ['Save details', 'Enregistrer les détails', 'Guardar detalles'],
    ['Publication year', 'Année de publication', 'Año de publicación'],
    ['Rating', 'Note', 'Valoración'],
    ['Not rated', 'Non noté', 'Sin valorar'],
    ['Clinical topic', 'Thème clinique', 'Tema clínico'],
    ['Theoretical approach', 'Approche théorique', 'Enfoque teórico'],
    ['Audience', 'Public', 'Público'],
    ['Personal notes', 'Notes personnelles', 'Notas personales'],
    ['Your first local agent', 'Votre premier agent local', 'Tu primer agente local'],
    ['An agent that fits your computer', 'Un agent adapté à votre ordinateur', 'Un agente adaptado a tu ordenador'],
    ['We check your hardware locally. Nothing is uploaded. You can skip this and keep using your library.', 'Le matériel est vérifié localement. Rien n’est envoyé. Vous pouvez passer cette étape et utiliser la bibliothèque.', 'Comprobamos tu hardware localmente. No se envía nada. Puedes omitir este paso y seguir usando tu biblioteca.'],
    ['Checking your computer…', 'Vérification de votre ordinateur…', 'Comprobando tu ordenador…'],
    ['Your computer', 'Votre ordinateur', 'Tu ordenador'],
    ['Graphics are shown for reference. GPU acceleration depends on Ollama and your drivers; the recommendation uses a CPU/RAM baseline.', 'La carte graphique est indiquée à titre informatif. Son accélération dépend d’Ollama et des pilotes ; le conseil se base sur le processeur et la RAM.', 'La gráfica se muestra como referencia. La aceleración depende de Ollama y tus controladores; la recomendación se basa en CPU y RAM.'],
    ['Install and open Ollama', 'Installer et ouvrir Ollama', 'Instalar y abrir Ollama'],
    ['Download the Windows installer from the official website, run it, and follow its prompts. Open Ollama from the Start menu after installation. If it is already running, go to step 2.', 'Téléchargez et lancez l’installateur Windows officiel, puis suivez ses instructions. Ouvrez Ollama depuis le menu Démarrer. S’il fonctionne déjà, passez à l’étape 2.', 'Descarga y ejecuta el instalador oficial de Windows y sigue sus instrucciones. Abre Ollama desde Inicio. Si ya está funcionando, ve al paso 2.'],
    ['Open official Ollama download', 'Ouvrir le téléchargement officiel', 'Abrir descarga oficial de Ollama'],
    ['Download your recommended model', 'Télécharger le modèle recommandé', 'Descargar el modelo recomendado'],
    ['Open a new PowerShell window from the Start menu. Copy and paste this command, then press Enter. Keep the window open until the download finishes. Internet is needed for this step; the terminal shows download progress.', 'Ouvrez une nouvelle fenêtre PowerShell depuis Démarrer. Collez cette commande et appuyez sur Entrée. Gardez la fenêtre ouverte jusqu’à la fin. Internet est nécessaire ; la progression apparaît dans le terminal.', 'Abre una nueva ventana de PowerShell desde Inicio. Pega este comando y pulsa Intro. Mantén la ventana abierta hasta terminar. Se necesita internet; el terminal muestra el progreso.'],
    ['Copy command', 'Copier la commande', 'Copiar comando'],
    ['If “ollama” is not recognized, finish installing Ollama and open a new PowerShell window. If connection fails, open Ollama and retry.', 'Si « ollama » n’est pas reconnu, terminez l’installation et ouvrez une nouvelle fenêtre PowerShell. Si la connexion échoue, ouvrez Ollama et réessayez.', 'Si no se reconoce «ollama», termina la instalación y abre una nueva ventana de PowerShell. Si falla la conexión, abre Ollama y reintenta.'],
    ['Connect the model to PsyShelf', 'Connecter le modèle à PsyShelf', 'Conectar el modelo a PsyShelf'],
    ['When PowerShell reports success, return here. We will check the model is installed before saving it as your library agent. This replaces your selected model without deleting existing downloads.', 'Revenez ici après le succès du téléchargement. Nous vérifions le modèle avant de le sélectionner. Les modèles déjà téléchargés ne sont pas supprimés.', 'Vuelve aquí cuando PowerShell indique que ha terminado. Comprobaremos el modelo antes de seleccionarlo. No se borrarán las descargas existentes.'],
    ['Check installation & use this model', 'Vérifier et utiliser ce modèle', 'Comprobar y usar este modelo'],
    ['Scan again', 'Vérifier à nouveau', 'Volver a comprobar'],
    ['Continue to library', 'Accéder à la bibliothèque', 'Continuar a la biblioteca'],
    ['Select a resource', 'Sélectionnez une ressource', 'Selecciona un recurso'],
    ['Preview it, review its metadata, share it, or ask the local agent for help.', 'Prévisualisez-la, vérifiez ses métadonnées, partagez-la ou demandez de l’aide à l’agent.', 'Previsualízalo, revisa sus metadatos, compártelo o pide ayuda al agente local.'],
    ['Run metadata agent', 'Analyser les métadonnées', 'Analizar metadatos'],
    ['Classification', 'Classification', 'Clasificación'],
    ['Record', 'Fiche', 'Registro'],
    ['Source', 'Source', 'Origen'],
    ['Status', 'État', 'Estado'],
    ['Updated', 'Mis à jour', 'Actualizado'],
    ['Resource details', 'Détails de la ressource', 'Detalles del recurso'],
    ['Year', 'Année', 'Año'],
    ['Approach', 'Approche', 'Enfoque'],
    ['Edit details & notes', 'Modifier les détails et notes', 'Editar detalles y notas'],
    ['Share', 'Partager', 'Compartir'],
    ['Include the file. I confirm that copyright or permission allows me to share it.', 'Inclure le fichier. Je confirme disposer des droits ou de l’autorisation nécessaires pour le partager.', 'Incluir el archivo. Confirmo que tengo los derechos o el permiso para compartirlo.'],
    ['Export shareable entry', 'Exporter la fiche à partager', 'Exportar entrada para compartir'],
    ['Remove entry', 'Supprimer l’entrée', 'Eliminar entrada'],
    ['Search title, author, topic, or language…', 'Rechercher un titre, auteur, thème ou langue…', 'Buscar título, autor, tema o idioma…'],
    ['Sort resources', 'Trier les ressources', 'Ordenar recursos'],
    ['What do I have about grief?', 'Quelles ressources ai-je sur le deuil ?', '¿Qué tengo sobre el duelo?'],
    ['Resource actions', 'Actions sur la ressource', 'Acciones del recurso'],
    ['Resource title', 'Titre de la ressource', 'Título del recurso'],
    ['One or more, separated by commas', 'Un ou plusieurs, séparés par des virgules', 'Uno o varios, separados por comas'],
    ['URL, Article', 'URL, Article', 'URL, Artículo'],
    ['English, French…', 'Anglais, français…', 'Inglés, francés…'],
    ['Why this resource is useful', 'Pourquoi cette ressource est utile', 'Por qué es útil este recurso'],
    ['Optional evidence or context', 'Éléments ou contexte facultatifs', 'Pruebas o contexto opcionales'],
    ['Optional', 'Facultatif', 'Opcional'],
    ['e.g. grief, anxiety', 'ex. deuil, anxiété', 'p. ej., duelo, ansiedad'],
    ['e.g. CBT, humanistic', 'ex. TCC, humaniste', 'p. ej., TCC, humanista'],
    ['e.g. clinicians, students, parents', 'ex. cliniciens, étudiants, parents', 'p. ej., profesionales, estudiantes, padres'],
    ['Your observations and reading notes', 'Vos observations et notes de lecture', 'Tus observaciones y notas de lectura'],
    ['Resource details saved.', 'Détails enregistrés.', 'Detalles guardados.'],
    ['Link added to your library.', 'Lien ajouté à votre bibliothèque.', 'Enlace añadido a tu biblioteca.'],
    ['Entry removed.', 'Entrée supprimée.', 'Entrada eliminada.'],
    ['The library entry was removed. Its file was preserved.', 'Entrée supprimée. Le fichier a été conservé.', 'Entrada eliminada. Se ha conservado el archivo.'],
    ['The library entry was removed.', 'L’entrée a été supprimée.', 'Se ha eliminado la entrada.'],
    ['Reviewing locally…', 'Vérification locale…', 'Revisando localmente…'],
    ['Analyzing locally…', 'Analyse locale…', 'Analizando localmente…'],
    ['Thinking on your computer…', 'Réflexion sur votre ordinateur…', 'Pensando en tu ordenador…'],
    ['Correction accepted', 'Correction acceptée', 'Corrección aceptada'],
    ['Agent kept the current metadata', 'L’agent a conservé les métadonnées', 'El agente ha conservado los metadatos'],
    ['Local review unavailable', 'Vérification locale indisponible', 'Revisión local no disponible'],
    ['Use my final override', 'Appliquer ma décision finale', 'Aplicar mi decisión final'],
    ['Your final override was applied.', 'Votre décision finale a été appliquée.', 'Se ha aplicado tu decisión final.'],
    ['Metadata reviewed by the local agent.', 'Métadonnées vérifiées par l’agent local.', 'Metadatos revisados por el agente local.'],
    ['Catalog search · Local AI offline', 'Recherche catalogue · IA locale hors ligne', 'Búsqueda en catálogo · IA local desconectada'],
    ['Ollama is not running yet', 'Ollama n’est pas encore lancé', 'Ollama aún no está funcionando'],
    ['Automatic cloud-folder backup on', 'Sauvegarde cloud automatique activée', 'Copia automática en la nube activada'],
    ['Status unavailable', 'État indisponible', 'Estado no disponible'],
    ['Local model preference saved.', 'Préférence du modèle enregistrée.', 'Preferencia de modelo guardada.'],
    ['Model command copied.', 'Commande du modèle copiée.', 'Comando del modelo copiado.'],
    ['Cloud backup folder connected.', 'Dossier de sauvegarde connecté.', 'Carpeta de copia conectada.'],
    ['System', 'Système', 'Sistema'],
    ['Processor', 'Processeur', 'Procesador'],
    ['Memory', 'Mémoire', 'Memoria'],
    ['Graphics', 'Carte graphique', 'Gráficos'],
    ['Free disk', 'Espace libre', 'Disco libre'],
    ['Model folder', 'Dossier du modèle', 'Carpeta del modelo'],
    ['Computer check complete.', 'Vérification terminée.', 'Comprobación terminada.'],
    ['Use the library without AI for now', 'Utiliser la bibliothèque sans IA pour le moment', 'Usar la biblioteca sin IA por ahora'],
    ['Selected using total RAM, memory available now, logical CPU count, and estimated disk space. Smaller models use fewer resources but give less reliable answers. This is an estimate; speed depends on your hardware and workload.', 'Choix basé sur la RAM totale et disponible, les processeurs logiques et l’espace estimé. Les petits modèles consomment moins mais sont moins fiables. La vitesse dépend du matériel et de la charge.', 'Selección basada en RAM total y disponible, procesadores lógicos y espacio estimado. Los modelos pequeños consumen menos, pero son menos fiables. La velocidad depende del hardware y la carga.'],
    ['Available memory or CPU capacity is limited. Close other apps and scan again, or continue using the library without AI.', 'La mémoire ou la capacité du processeur est limitée. Fermez des applications et réessayez, ou continuez sans IA.', 'La memoria o capacidad de CPU es limitada. Cierra otras aplicaciones y vuelve a comprobar, o continúa sin IA.'],
    ['There is not enough free space on the estimated model drive. Free up space or change Ollama’s model location, then scan again.', 'Espace insuffisant sur le disque estimé du modèle. Libérez de l’espace ou changez son emplacement dans Ollama, puis réessayez.', 'No hay espacio suficiente en la unidad estimada del modelo. Libera espacio o cambia su ubicación en Ollama y vuelve a comprobar.'],
    ['This model is already installed. You can connect it in step 3.', 'Ce modèle est déjà installé. Connectez-le à l’étape 3.', 'Este modelo ya está instalado. Puedes conectarlo en el paso 3.'],
    ['Ollama is running. Follow step 2 to download the recommended model.', 'Ollama fonctionne. Suivez l’étape 2 pour télécharger le modèle.', 'Ollama está funcionando. Sigue el paso 2 para descargar el modelo.'],
    ['Ollama is offline or not installed. Start with step 1.', 'Ollama est hors ligne ou absent. Commencez par l’étape 1.', 'Ollama está desconectado o no está instalado. Empieza por el paso 1.'],
    ['Command copied. Paste it into a new PowerShell window and press Enter.', 'Commande copiée. Collez-la dans une nouvelle fenêtre PowerShell et appuyez sur Entrée.', 'Comando copiado. Pégalo en una nueva ventana de PowerShell y pulsa Intro.'],
    ['Copy the command shown in step 2 manually.', 'Copiez manuellement la commande de l’étape 2.', 'Copia manualmente el comando del paso 2.'],
    ['Checking the local installation…', 'Vérification de l’installation locale…', 'Comprobando la instalación local…'],
    ['The model is not installed yet. Complete the download in PowerShell, then try again.', 'Le modèle n’est pas encore installé. Terminez le téléchargement dans PowerShell, puis réessayez.', 'El modelo aún no está instalado. Termina la descarga en PowerShell y vuelve a intentarlo.'],
    ['Open with Windows', 'Ouvrir avec Windows', 'Abrir con Windows'],
    ['Open in browser', 'Ouvrir dans le navigateur', 'Abrir en el navegador'],
    ['Loading preview…', 'Chargement de l’aperçu…', 'Cargando vista previa…'],
    ['Text preview shows up to the first 24,000 characters.', 'L’aperçu affiche les 24 000 premiers caractères au maximum.', 'La vista previa muestra hasta los primeros 24 000 caracteres.'],
    ['This media could not be displayed. Try Open with Windows.', 'Impossible d’afficher ce média. Essayez Ouvrir avec Windows.', 'No se ha podido mostrar este archivo. Prueba Abrir con Windows.'],
    ['Some websites block embedded previews. If the page is blank or sign-in is required, choose Open in browser.', 'Certains sites bloquent les aperçus intégrés. Si la page est vide ou exige une connexion, ouvrez-la dans le navigateur.', 'Algunos sitios bloquean las vistas incrustadas. Si la página está vacía o requiere iniciar sesión, ábrela en el navegador.'],
    ['The file is missing or this entry has no attached file to preview.', 'Le fichier est introuvable ou cette entrée n’a pas de fichier joint.', 'El archivo no se encuentra o esta entrada no tiene un archivo adjunto.'],
    ['Rating must be a whole number from 1 to 5, or empty.', 'La note doit être un entier de 1 à 5, ou rester vide.', 'La valoración debe ser un entero del 1 al 5, o estar vacía.'],
    ['Publication year must be a whole number from 1 to 9999, or empty.', 'L’année doit être un entier de 1 à 9999, ou rester vide.', 'El año debe ser un entero del 1 al 9999, o estar vacío.'],
    ['Resource not found.', 'Ressource introuvable.', 'Recurso no encontrado.'],
    ['File not found.', 'Fichier introuvable.', 'Archivo no encontrado.']
  ];

  const dictionary = new Map(messages.map(([key, fr, es]) => [key, { French: fr, Spanish: es }]));
  const patterns = [
    [/^Search: “([\s\S]*)”$/, (m,l) => l === 'French' ? `Recherche : « ${m[1]} »` : `Búsqueda: «${m[1]}»`],
    [/^(.*) · (\d+) logical processors$/, (m,l) => `${m[1]} · ${m[2]} ${l === 'French' ? 'processeurs logiques' : 'procesadores lógicos'}`],
    [/^(.+) GiB total · (.+) GiB available now$/, (m,l) => l === 'French' ? `${m[1]} Gio au total · ${m[2]} Gio disponibles` : `${m[1]} GiB en total · ${m[2]} GiB disponibles`],
    [/^(.+) GB on the estimated model drive$/, (m,l) => l === 'French' ? `${m[1]} Go sur le disque estimé du modèle` : `${m[1]} GB en la unidad estimada del modelo`],
    [/^(.*) \(estimated; Ollama may use a different location\)$/, (m,l) => l === 'French' ? `${m[1]} (estimation ; Ollama peut utiliser un autre emplacement)` : `${m[1]} (estimación; Ollama puede usar otra ubicación)`],
    [/^(\d+) resources? added as editable drafts\.$/, (m,l) => l === 'French' ? `${m[1]} ressource(s) ajoutée(s) comme brouillons modifiables.` : `${m[1]} recurso(s) añadido(s) como borradores editables.`],
    [/^Local · (.*)$/, (m,l) => `${l === 'French' ? 'Local' : 'Local'} · ${m[1]}`],
    [/^(\d+) resources?$/, (m, l) => l === 'French' ? `${m[1]} ressource${m[1] === '1' ? '' : 's'}` : `${m[1]} recurso${m[1] === '1' ? '' : 's'}`],
    [/^You are about to delete “([\s\S]*)” from your library\.$/, (m,l) => l === 'French' ? `Vous allez supprimer « ${m[1]} » de votre bibliothèque.` : `Vas a eliminar «${m[1]}» de tu biblioteca.`],
    [/^Recommended: (.*)$/, (m,l) => `${l === 'French' ? 'Recommandé' : 'Recomendado'} : ${m[1]}`],
    [/^(\d+) local models? available$/, (m,l) => l === 'French' ? `${m[1]} modèle(s) local(aux) disponible(s)` : `${m[1]} modelo(s) local(es) disponible(s)`],
    [/^Approximately (.+) GB to download\. Allow extra space for Ollama and installation\. Close memory-heavy apps before using the agent\.$/, (m,l) => l === 'French' ? `Environ ${m[1]} Go à télécharger. Prévoyez de l’espace pour Ollama et l’installation. Fermez les applications gourmandes en mémoire.` : `Aproximadamente ${m[1]} GB de descarga. Reserva espacio para Ollama y la instalación. Cierra las aplicaciones que consuman mucha memoria.`],
    [/^(.*) is installed and selected\. Your library agent is ready\. You can continue to the library\.$/, (m,l) => l === 'French' ? `${m[1]} est installé et sélectionné. Votre agent est prêt. Vous pouvez accéder à la bibliothèque.` : `${m[1]} está instalado y seleccionado. Tu agente está listo. Puedes continuar a la biblioteca.`],
    [/^Backup updated in (.*)\.$/, (m,l) => l === 'French' ? `Sauvegarde mise à jour dans ${m[1]}.` : `Copia actualizada en ${m[1]}.`]
  ];
  let language = 'English';
  const originals = new WeakMap();
  const attributes = new WeakMap();
  // These nodes contain user-owned metadata or generated/file content, not interface copy.
  const excluded = 'script,style,code,pre,textarea,[translate="no"],#interfaceLanguage option,.resource-card h3,.card-author,.card-description,.pill,#categoryFilters,#languageFilters,.detail-hero h2,.detail-hero p,.detail-description:not([data-ui]),.metadata-item strong:not([data-ui]),#resourceDetailsName,#settingsBackupPath';
  function translate(value) {
    if (language === 'English') return value;
    const key = value.trim();
    let replacement = dictionary.get(key)?.[language];
    if (!replacement) for (const [pattern, format] of patterns) {
      const match = key.match(pattern);
      if (match) { replacement = format(match, language); break; }
    }
    return replacement ? value.replace(key, replacement) : value;
  }
  function refresh() {
    observer.disconnect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement || node.parentElement.closest(excluded) || node.parentElement.closest('#chatMessages .message:not(:first-child):not(.loading)')) continue;
      const previous = originals.get(node);
      const source = previous && node.nodeValue === previous.rendered ? previous.source : node.nodeValue;
      const rendered = translate(source);
      originals.set(node, { source, rendered });
      if (node.nodeValue !== rendered) node.nodeValue = rendered;
    }
    for (const element of document.querySelectorAll('[placeholder],[aria-label]')) {
      if (element.closest('[translate="no"]')) continue;
      const saved = attributes.get(element) || {};
      for (const name of ['placeholder', 'aria-label']) {
        if (!element.hasAttribute(name)) continue;
        const value = element.getAttribute(name);
        const previous = saved[name];
        const source = previous && value === previous.rendered ? previous.source : value;
        const rendered = translate(source);
        saved[name] = { source, rendered };
        if (value !== rendered) element.setAttribute(name, rendered);
      }
      attributes.set(element, saved);
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label'] });
  }
  const observer = new MutationObserver(refresh);
  window.psyI18n = {
    get language() { return language; },
    translate,
    setLanguage(value) {
      language = ['English', 'French', 'Spanish'].includes(value) ? value : 'English';
      document.documentElement.lang = { English: 'en', French: 'fr', Spanish: 'es' }[language];
      refresh();
    }
  };
  refresh();
})();
