-- Mise à niveau du stockage des pièces jointes pour les plans et modèles 3D.
-- À exécuter une fois dans Supabase > SQL Editor pour accepter les fichiers
-- STEP/STP/STL/OBJ/GLB/GLTF jusqu'à 50 Mo.

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed',
      'application/octet-stream'
    ]
where id = 'achat-attachments';
