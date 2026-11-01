import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { palette } from '@/lib/theme';

export default function NotFoundScreen() {
  return (
    <Screen>
      <EmptyState
        className="mt-10"
        icon={<Feather name="compass" size={26} color={palette.muted} />}
        title="No encontramos esa pantalla"
        description="El enlace puede estar vencido o la ruta ya no existe."
        action={
          <Button
            label="Volver al inicio"
            onPress={() => router.replace('/')}
            icon={<Feather name="arrow-left" size={15} color={palette.primaryFg} />}
          />
        }
      />
    </Screen>
  );
}
