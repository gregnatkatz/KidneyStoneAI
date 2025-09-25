import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Search, 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  Heart, 
  Activity,
  FileText,
  Image as ImageIcon
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { VoiceEnabledImageDisplay } from './VoiceEnabledImageDisplay'
import PatientImagingResults from './PatientImagingResults'
import { apiConfig, apiCall } from '@/config/api'


interface EMRDataProps {
  token: string
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  email: string
  phone: string
  address: {
    street: string
    city: string
    state: string
    zip_code: string
    country: string
  }
  medical_record_number: string
  insurance_provider: string
  emergency_contact: {
    name: string
    relationship: string
    phone: string
  }
  avatar_url: string
  created_at: string
  age?: number
  riskLevel?: "High" | "Moderate" | "Low"
  riskScore?: {
    stones: number
    recurrence: number
  }
  imaging?: Array<{
    id: string
    type: string
    date: string
    findings: string[]
    imagePath: string
    status: "normal" | "abnormal" | "mild"
  }>
}

interface MedicalTest {
  id: string
  test_type: string
  test_name: string
  test_date: string
  ordered_by: string
  facility: string
  status: string
  results: {
    interpretation: string
    abnormal_flags: string[]
  }
}

interface MedicalImage {
  id: string
  image_path: string
  diagnosis: string
  acquisition_date: string
  study_description: string
  findings: string[]
  radiologist_notes?: string
  measurements: Record<string, number>
}

export function EMRData({ token }: EMRDataProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientTests, setPatientTests] = useState<MedicalTest[]>([])
  const [patientImages, setPatientImages] = useState<MedicalImage[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [enhancedPatients, setEnhancedPatients] = useState<Patient[]>([])

  useEffect(() => {
    fetchPatients()
  }, [token])

  // REM: Enhance patients with imaging data and risk assessment
  useEffect(() => {
    if (patients.length > 0) {
      const enhancePatients = async () => {
        const enhanced = await Promise.all(patients.map(async (patient) => {
          try {
            const imagingRes = await apiCall(`${apiConfig.endpoints.patients}/${patient.id}/imaging`)
            const imagingData = await imagingRes.json()
            
            return {
              ...patient,
              age: calculateAge(patient.date_of_birth),
              riskLevel: generateRiskLevel(),
              riskScore: {
                stones: Math.floor(Math.random() * 80) + 20,
                recurrence: Math.floor(Math.random() * 60) + 15
              },
              imaging: imagingData.imaging_studies || []
            }
          } catch (error) {
            console.error(`Failed to fetch imaging for patient ${patient.id}:`, error)
            return {
              ...patient,
              age: calculateAge(patient.date_of_birth),
              riskLevel: generateRiskLevel(),
              riskScore: {
                stones: Math.floor(Math.random() * 80) + 20,
                recurrence: Math.floor(Math.random() * 60) + 15
              },
              imaging: []
            }
          }
        }))
        setEnhancedPatients(enhanced)
      }
      enhancePatients()
    }
  }, [patients])

  const fetchPatients = async () => {
    try {
      const response = await apiCall(`${apiConfig.endpoints.patients}?limit=50`)
      const data = await response.json()
      setPatients(data)
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPatientDetails = async (patientId: string) => {
    try {
      const [testsRes, imagesRes] = await Promise.all([
        apiCall(`${apiConfig.endpoints.patients}/${patientId}/tests`),
        apiCall(`${apiConfig.endpoints.patients}/${patientId}/imaging`)
      ])

      const tests = await testsRes.json()
      const images = await imagesRes.json()

      setPatientTests(tests)
      
      const processedImages = images.imaging_studies || [];
      
      setPatientImages(processedImages)
    } catch (error) {
      console.error('Failed to fetch patient details:', error)
      setPatientImages([])
    }
  }

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
    fetchPatientDetails(patient.id)
  }

  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.medical_record_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age
  }

  // REM: Generate random risk level for demonstration
  const generateRiskLevel = (): "High" | "Moderate" | "Low" => {
    const rand = Math.random()
    if (rand < 0.2) return "High"
    if (rand < 0.6) return "Moderate"
    return "Low"
  }

  // REM: Handle patient selection for imaging results
  const handlePatientSelectForImaging = (patientId: string) => {
    const patient = enhancedPatients.find(p => p.id === patientId)
    if (patient) {
      setSelectedPatient(patient)
      fetchPatientDetails(patientId)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2 animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-blue-400" />
            <span>Patient Directory</span>
          </CardTitle>
          <CardDescription>
            Search and select patients from the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredPatients.map((patient) => (
                <Button
                  key={patient.id}
                  variant={selectedPatient?.id === patient.id ? "default" : "ghost"}
                  className="w-full justify-start h-auto p-3"
                  onClick={() => handlePatientSelect(patient)}
                >
                  <div className="flex items-center space-x-3 text-left w-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={patient.avatar_url} alt={`${patient.first_name} ${patient.last_name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-400">
                        {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        MRN: {patient.medical_record_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {calculateAge(patient.date_of_birth)}y, {patient.gender}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2">
        {selectedPatient ? (
          <Tabs defaultValue="demographics" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="tests">Medical Tests</TabsTrigger>
              <TabsTrigger value="enhanced-imaging">Enhanced Imaging Results</TabsTrigger>
            </TabsList>

            <TabsContent value="demographics" className="space-y-4">
              <Card className="bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={selectedPatient.avatar_url} alt={`${selectedPatient.first_name} ${selectedPatient.last_name}`} />
                      <AvatarFallback className="bg-gradient-to-br from-green-500/20 to-green-600/10 text-green-400 text-lg">
                        {selectedPatient.first_name.charAt(0)}{selectedPatient.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span>{selectedPatient.first_name} {selectedPatient.last_name}</span>
                      <div className="text-sm text-muted-foreground font-normal">
                        Patient demographics and contact information
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Date of Birth:</span>
                        <span>{new Date(selectedPatient.date_of_birth).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Gender:</span>
                        <span>{selectedPatient.gender}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Age:</span>
                        <span>{calculateAge(selectedPatient.date_of_birth)} years</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span>
                        <span className="text-blue-600">{selectedPatient.email}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone:</span>
                        <span>{selectedPatient.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">MRN:</span>
                        <span>{selectedPatient.medical_record_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>Address</span>
                      </h4>
                      <div className="text-sm text-muted-foreground">
                        <div>{selectedPatient.address.street}</div>
                        <div>
                          {selectedPatient.address.city}, {selectedPatient.address.state} {selectedPatient.address.zip_code}
                        </div>
                        <div>{selectedPatient.address.country}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Emergency Contact</h4>
                      <div className="text-sm text-muted-foreground">
                        <div>{selectedPatient.emergency_contact.name}</div>
                        <div>{selectedPatient.emergency_contact.relationship}</div>
                        <div>{selectedPatient.emergency_contact.phone}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Insurance</h4>
                      <div className="text-sm text-muted-foreground">
                        {selectedPatient.insurance_provider}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tests" className="space-y-4">
              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-purple-400" />
                    <span>Medical Test History</span>
                  </CardTitle>
                  <CardDescription>
                    Comprehensive 2-year medical test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {patientTests.map((test) => (
                      <div key={test.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{test.test_name}</h4>
                          <Badge variant={test.status === 'completed' ? 'default' : 'secondary'}>
                            {test.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>Type: {test.test_type}</div>
                          <div>Date: {new Date(test.test_date).toLocaleDateString()}</div>
                          <div>Ordered by: {test.ordered_by}</div>
                          <div>Facility: {test.facility}</div>
                        </div>
                        <div className="text-sm">
                          <div className="font-medium">Interpretation:</div>
                          <div>{test.results.interpretation}</div>
                          {test.results.abnormal_flags.length > 0 && (
                            <div className="mt-2">
                              <div className="font-medium text-orange-600">Abnormal Findings:</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {test.results.abnormal_flags.map((flag, index) => (
                                  <Badge key={index} variant="destructive" className="text-xs">
                                    {flag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="imaging" className="space-y-4">
              <Card className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ImageIcon className="h-5 w-5 text-orange-400" />
                    <span>Medical Imaging Studies</span>
                  </CardTitle>
                  <CardDescription>
                    CT scans and imaging studies from CT kidney dataset
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {patientImages.map((image) => (
                      <div key={image.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{image.study_description}</h4>
                          <Badge variant={
                            image.diagnosis === 'Normal' ? 'default' :
                            image.diagnosis === 'Stone' ? 'destructive' :
                            'secondary'
                          }>
                            {image.diagnosis}
                          </Badge>
                        </div>
                        
                        <div className="mb-4 bg-gray-900 rounded-lg p-2 flex items-center justify-center min-h-[200px]">
                          <VoiceEnabledImageDisplay 
                            imageId={image.id} 
                            diagnosis={image.diagnosis}
                            findings={image.findings}
                            radiologistNotes={image.radiologist_notes || undefined}
                            measurements={image.measurements || {}}
                          />
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          <div>Date: {new Date(image.acquisition_date).toLocaleDateString()}</div>
                          <div>Path: {image.image_path}</div>
                        </div>

                        <div className="text-sm">
                          <div className="font-medium mb-1">Findings:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {image.findings.map((finding, index) => (
                              <li key={index} className="text-muted-foreground">
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-muted/50 rounded p-2 text-xs">
                          <div className="font-medium">CT Kidney Dataset Reference</div>
                          <div className="text-muted-foreground">
                            CT KIDNEY DATASET: Normal-Cyst-Tumor-Stone
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="enhanced-imaging" className="space-y-4">
              {enhancedPatients.length > 0 && selectedPatient ? (
                <PatientImagingResults
                  patients={enhancedPatients}
                  onPatientSelect={handlePatientSelectForImaging}
                  selectedPatientId={selectedPatient.id}
                />
              ) : (
                <Card className="bg-blue-500/10 border border-blue-500/20">
                  <CardContent className="flex items-center justify-center h-96">
                    <div className="text-left text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
                      <h3 className="text-xl font-semibold text-white mb-2 text-left">
                        {selectedPatient ? 'Loading Enhanced Imaging Results' : 'No Patient Selected'}
                      </h3>
                      <p className="text-gray-400 text-left">
                        {selectedPatient 
                          ? 'Preparing comprehensive patient imaging analysis system...'
                          : 'Please select a patient from the directory to view their enhanced imaging results.'
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="bg-gradient-to-br from-gray-500/20 to-gray-600/10 border-gray-500/30">
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a patient from the directory to view their EMR data</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
