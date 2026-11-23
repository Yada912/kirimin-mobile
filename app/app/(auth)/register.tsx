import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Package,
  Bike,
  Car,
  Check,
  MapPin,
  Sparkles,
  Home,
  GraduationCap,
  Briefcase,
} from '../../src/ui/icons';
import type { Role, SavedPlaceKind, VehicleType } from '@kirimin/shared';
import { SAVED_PLACE_LABELS } from '@kirimin/shared';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  Text,
  TopBar,
  StepHeader,
  TextField,
  Button,
  Card,
  MapView,
  BrandLogo,
} from '../../src/ui';
import { useAuth } from '../../src/auth/AuthContext';
import { api } from '../../src/api/client';
import { BALI_PLACES, PLACE_BY_ID } from '../../src/constants/places';

function passwordStrength(pw: string): { label: string; score: number; color: string } {
  if (!pw) return { label: '', score: 0, color: colors.border };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) || /[0-9]/.test(pw)) score += 1;
  if (score <= 1) return { label: 'Lemah', score: 1, color: colors.semantic.danger };
  if (score === 2) return { label: 'Sedang', score: 2, color: colors.accent.amber };
  return { label: 'Kuat', score: 3, color: colors.driver };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Account Info
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Step 2: Role & Vehicle
  const [role, setRole] = useState<Role>('sender');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motor');
  const [plate, setPlate] = useState('DK 4521 AB');

  // Step 3: Favorite First Location (Saved Place)
  const [favKind, setFavKind] = useState<SavedPlaceKind>('home');
  const [favLabel, setFavLabel] = useState('Kos Renon');
  const [favPlace, setFavPlace] = useState(PLACE_BY_ID.tukad_badung);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const validateStep1 = () => {
    if (name.trim().length < 2) {
      setError('Nama lengkap minimal 2 karakter');
      return false;
    }
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 9) {
      setError('Masukkan nomor HP yang valid (minimal 9 digit)');
      return false;
    }
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Format email tidak valid');
      return false;
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter');
      return false;
    }
    if (confirmPassword !== password) {
      setError('Konfirmasi kata sandi tidak cocok');
      return false;
    }
    if (!agreedTerms) {
      setError('Setujui ketentuan layanan Kirimin untuk melanjutkan');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    if (role === 'driver' && plate.trim().length < 3) {
      setError('Masukkan nomor plat kendaraan Anda (contoh: DK 4521 AB)');
      return false;
    }
    setError(null);
    return true;
  };

  const handleCompleteRegistration = async (saveFavoritePlace: boolean) => {
    try {
      setLoading(true);
      setError(null);

      await register({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password,
        role,
        ...(role === 'driver' && plate.trim().length >= 3
          ? { vehicle: { type: vehicleType, plate: plate.trim().toUpperCase() } }
          : {}),
      });

      if (saveFavoritePlace && favLabel.trim()) {
        try {
          await api.post('/me/places', {
            kind: favKind,
            label: favLabel.trim(),
            address: favPlace.label,
            lat: favPlace.lat,
            lng: favPlace.lng,
          });
        } catch {
          // Non-blocking: user account is already created
        }
      }

      if (role === 'driver') {
        router.replace('/(angkut)/beranda');
      } else {
        router.replace('/(kirim)/beranda');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <TopBar
        title="Buat akun"
        subtitle={`Langkah ${step} dari 3`}
        onBack={() => {
          if (step > 1) {
            setStep((s) => (s - 1) as 1 | 2 | 3);
            setError(null);
          } else {
            router.back();
          }
        }}
      />
      <StepHeader steps={['Akun', 'Peran', 'Lokasi']} currentStep={step} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {error ? (
            <Card variant="flat" padding="md" style={styles.errorCard}>
              <Text variant="callout" color={colors.semantic.danger}>
                {error}
              </Text>
            </Card>
          ) : null}

          {/* STEP 1: Account Details */}
          {step === 1 ? (
            <View>
              <View style={styles.stepBanner}>
                <BrandLogo size="xs" tone="kirim" surface="tile" />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text variant="headline" color={colors.text.primary} weight="700">
                    Buat Akun Baru
                  </Text>
                  <Text variant="caption" color={colors.text.secondary}>
                    Cukup 1 akun untuk mengirim paket sekaligus jadi pengemudi searah.
                  </Text>
                </View>
              </View>

              <TextField
                label="Nama lengkap"
                placeholder="Contoh: Ketut Suartika"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                leftElement={<User size={17} color={colors.text.muted} />}
              />

              <TextField
                label="Nomor HP (WhatsApp)"
                placeholder="Contoh: 081234567890"
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setError(null);
                }}
                keyboardType="phone-pad"
                autoCapitalize="none"
                leftElement={<Phone size={17} color={colors.text.muted} />}
              />

              <TextField
                label="Email (opsional)"
                placeholder="Contoh: ketut@email.com"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                leftElement={<Mail size={17} color={colors.text.muted} />}
              />

              <TextField
                label="Kata sandi"
                placeholder="Minimal 6 karakter"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                leftElement={<Lock size={17} color={colors.text.muted} />}
                rightElement={
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                    {showPassword ? (
                      <EyeOff size={18} color={colors.text.muted} />
                    ) : (
                      <Eye size={18} color={colors.text.muted} />
                    )}
                  </Pressable>
                }
              />

              {/* Password strength meter */}
              {password.length > 0 ? (
                <View style={styles.strengthRow}>
                  {[1, 2, 3].map((lvl) => (
                    <View
                      key={lvl}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            strength.score >= lvl ? strength.color : colors.border,
                        },
                      ]}
                    />
                  ))}
                  <Text
                    variant="caption"
                    color={strength.color}
                    weight="700"
                    style={{ marginLeft: 6 }}
                  >
                    {strength.label}
                  </Text>
                </View>
              ) : null}

              <TextField
                label="Ulangi kata sandi"
                placeholder="Ulangi kata sandi"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                leftElement={<Lock size={17} color={colors.text.muted} />}
              />

              <Pressable
                onPress={() => setAgreedTerms((v) => !v)}
                style={styles.termsRow}
              >
                <View style={[styles.checkbox, agreedTerms && styles.checkboxChecked]}>
                  {agreedTerms ? <Check size={13} color="#FFFFFF" /> : null}
                </View>
                <Text variant="caption" color={colors.text.secondary} style={{ flex: 1, marginLeft: spacing.sm }}>
                  Saya menyetujui Ketentuan Layanan dan Kebijakan Privasi Kirimin Bali.
                </Text>
              </Pressable>

              <Button
                label="Lanjut"
                variant="primary"
                size="lg"
                onPress={() => {
                  if (validateStep1()) setStep(2);
                }}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ) : null}

          {/* STEP 2: Role & Vehicle Setup */}
          {step === 2 ? (
            <View>
              <Text variant="title" color={colors.text.primary} weight="700" style={{ marginBottom: 4 }}>
                Kamu lebih sering jadi apa?
              </Text>
              <Text variant="callout" color={colors.text.secondary} style={{ marginBottom: spacing.md }}>
                Tenang, kamu bisa beralih antara Kirim & Angkut kapan saja dari Beranda.
              </Text>

              <View style={styles.roleCards}>
                <Pressable
                  onPress={() => setRole('sender')}
                  style={[
                    styles.roleCard,
                    role === 'sender' && styles.roleCardBlue,
                  ]}
                >
                  <View style={[styles.roleIcon, { backgroundColor: colors.primaryLight }]}>
                    <Package size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text variant="headline" color={colors.text.primary} weight="700">
                      Pengirim Paket (Kirim)
                    </Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      Titip dokumen, makanan, atau barang ke pengendara searah.
                    </Text>
                  </View>
                  {role === 'sender' ? (
                    <View style={[styles.checkDot, { backgroundColor: colors.primary }]}>
                      <Check size={14} color="#FFF" />
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  onPress={() => setRole('driver')}
                  style={[
                    styles.roleCard,
                    role === 'driver' && styles.roleCardGreen,
                  ]}
                >
                  <View style={[styles.roleIcon, { backgroundColor: colors.driverLight }]}>
                    <Bike size={24} color={colors.driver} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text variant="headline" color={colors.text.primary} weight="700">
                      Pengemudi (Angkut)
                    </Text>
                    <Text variant="caption" color={colors.text.secondary}>
                      Buka rute harianmu & dapat penghasilan dari paket searah.
                    </Text>
                  </View>
                  {role === 'driver' ? (
                    <View style={[styles.checkDot, { backgroundColor: colors.driver }]}>
                      <Check size={14} color="#FFF" />
                    </View>
                  ) : null}
                </Pressable>
              </View>

              {/* Inline Vehicle Setup when Driver is selected */}
              {role === 'driver' ? (
                <Card variant="outlined" padding="md" style={styles.vehicleSetupCard}>
                  <Text variant="headline" color={colors.driverDeep} weight="700" style={{ marginBottom: spacing.sm }}>
                    Kendaraan
                  </Text>
                  <View style={styles.vehicleTypeRow}>
                    <Pressable
                      onPress={() => setVehicleType('motor')}
                      style={[
                        styles.vChip,
                        vehicleType === 'motor' && styles.vChipActive,
                      ]}
                    >
                      <Bike size={18} color={vehicleType === 'motor' ? '#FFF' : colors.driver} />
                      <Text
                        variant="calloutSemibold"
                        color={vehicleType === 'motor' ? '#FFF' : colors.text.primary}
                        style={{ marginLeft: 6 }}
                      >
                        Motor
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setVehicleType('mobil')}
                      style={[
                        styles.vChip,
                        vehicleType === 'mobil' && styles.vChipActive,
                      ]}
                    >
                      <Car size={18} color={vehicleType === 'mobil' ? '#FFF' : colors.driver} />
                      <Text
                        variant="calloutSemibold"
                        color={vehicleType === 'mobil' ? '#FFF' : colors.text.primary}
                        style={{ marginLeft: 6 }}
                      >
                        Mobil
                      </Text>
                    </Pressable>
                  </View>

                  <TextField
                    label="Plat nomor"
                    placeholder="Contoh: DK 4521 AB"
                    value={plate}
                    onChangeText={setPlate}
                    autoCapitalize="characters"
                    containerStyle={{ marginTop: spacing.md, marginBottom: 0 }}
                  />
                </Card>
              ) : null}

              <Button
                label="Lanjut"
                variant="primary"
                size="lg"
                onPress={() => {
                  if (validateStep2()) setStep(3);
                }}
                style={{ marginTop: spacing.lg }}
              />
            </View>
          ) : null}

          {/* STEP 3: Save First Favorite Location */}
          {step === 3 ? (
            <View>
              <Text variant="title" color={colors.text.primary} weight="700" style={{ marginBottom: 4 }}>
                Simpan alamat pertamamu
              </Text>
              <Text variant="callout" color={colors.text.secondary} style={{ marginBottom: spacing.md }}>
                Ketuk peta atau pilih area agar nanti kamu tidak perlu mencari ulang alamat rumah/kampus.
              </Text>

              <MapView
                pickup={favPlace}
                height={180}
                showSettings
                selectionMode="pickup"
                onSelectLocation={(p) => setFavPlace({ ...favPlace, label: p.label, lat: p.lat, lng: p.lng })}
              />

              <View style={styles.quickPlaceRow}>
                {BALI_PLACES.slice(0, 4).map((p) => {
                  const active = favPlace.label === p.label;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setFavPlace(p)}
                      style={[styles.quickPlaceChip, active && styles.quickPlaceChipActive]}
                    >
                      <MapPin size={12} color={active ? '#FFF' : colors.primary} />
                      <Text
                        variant="caption"
                        color={active ? '#FFF' : colors.text.primary}
                        weight="600"
                        style={{ marginLeft: 4 }}
                      >
                        {p.label.split(',')[0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.kindRow}>
                {(['home', 'campus', 'work'] as SavedPlaceKind[]).map((k) => {
                  const active = favKind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setFavKind(k)}
                      style={[styles.kindChip, active && styles.kindChipActive]}
                    >
                      {k === 'home' ? (
                        <Home size={14} color={active ? '#FFF' : colors.accent.violet} />
                      ) : k === 'campus' ? (
                        <GraduationCap size={14} color={active ? '#FFF' : colors.accent.violet} />
                      ) : (
                        <Briefcase size={14} color={active ? '#FFF' : colors.accent.violet} />
                      )}
                      <Text
                        variant="captionMedium"
                        color={active ? '#FFF' : colors.text.primary}
                        weight="700"
                        style={{ marginLeft: 5 }}
                      >
                        {SAVED_PLACE_LABELS[k]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextField
                label="Nama tempat"
                placeholder="Contoh: Kos Renon, Kampus Bukit"
                value={favLabel}
                onChangeText={setFavLabel}
              />

              <Button
                label="Selesai"
                variant="primary"
                size="lg"
                loading={loading}
                onPress={() => handleCompleteRegistration(true)}
                style={{ marginTop: spacing.xs }}
              />
              <Button
                label="Lewati dulu"
                variant="ghost"
                size="md"
                disabled={loading}
                onPress={() => handleCompleteRegistration(false)}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 40,
  },
  errorCard: {
    backgroundColor: colors.semantic.dangerLight,
    marginBottom: spacing.md,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySubtle,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -6,
    marginBottom: spacing.md,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleCards: {
    gap: spacing.md,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  roleCardBlue: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtle,
  },
  roleCardGreen: {
    borderColor: colors.driver,
    backgroundColor: colors.driverSubtle,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleSetupCard: {
    marginTop: spacing.md,
    backgroundColor: colors.driverSubtle,
    borderColor: colors.driverLight,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.driverLight,
    backgroundColor: colors.surface,
  },
  vChipActive: {
    backgroundColor: colors.driver,
    borderColor: colors.driver,
  },
  quickPlaceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  quickPlaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickPlaceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  kindChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: colors.accent.violetLight,
  },
  kindChipActive: {
    backgroundColor: colors.accent.violet,
  },
});
