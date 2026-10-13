import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wind, 
  Factory, 
  Car, 
  TreePine, 
  AlertTriangle, 
  TrendingDown,
  MapPin,
  Calendar,
  BarChart3
} from 'lucide-react';

export default function AirPollution() {
  const [selectedCity, setSelectedCity] = useState('Cairo');

  const airQualityData = {
    Cairo: { aqi: 168, level: 'Unhealthy', color: 'bg-red-500' },
    Alexandria: { aqi: 142, level: 'Unhealthy for Sensitive Groups', color: 'bg-orange-500' },
    Giza: { aqi: 156, level: 'Unhealthy', color: 'bg-red-500' },
    Luxor: { aqi: 89, level: 'Moderate', color: 'bg-yellow-500' },
  };

  const pollutants = [
    { name: 'PM2.5', value: 78, unit: 'μg/m³', status: 'High', color: 'text-red-600' },
    { name: 'PM10', value: 125, unit: 'μg/m³', status: 'High', color: 'text-red-600' },
    { name: 'NO2', value: 45, unit: 'ppb', status: 'Moderate', color: 'text-yellow-600' },
    { name: 'O3', value: 32, unit: 'ppb', status: 'Good', color: 'text-green-600' },
    { name: 'CO', value: 1.2, unit: 'ppm', status: 'Good', color: 'text-green-600' },
    { name: 'SO2', value: 8, unit: 'ppb', status: 'Good', color: 'text-green-600' },
  ];

  const solutions = [
    {
      icon: <TreePine className="h-8 w-8 text-green-600" />,
      title: "Urban Reforestation",
      description: "Plant trees and create green spaces to naturally filter air pollutants",
      impact: "Reduces PM2.5 by up to 27%",
      cost: "Low-Medium"
    },
    {
      icon: <Car className="h-8 w-8 text-blue-600" />,
      title: "Electric Vehicle Adoption",
      description: "Transition to electric public transport and incentivize EV ownership",
      impact: "Reduces NOx emissions by 40%",
      cost: "High"
    },
    {
      icon: <Factory className="h-8 w-8 text-purple-600" />,
      title: "Industrial Emission Control",
      description: "Implement strict emission standards and monitoring for industries",
      impact: "Reduces overall emissions by 35%",
      cost: "Medium-High"
    },
    {
      icon: <Wind className="h-8 w-8 text-cyan-600" />,
      title: "Renewable Energy",
      description: "Shift from fossil fuels to solar and wind energy sources",
      impact: "Reduces CO2 by 50%",
      cost: "Medium"
    }
  ];

  const currentAQI = airQualityData[selectedCity as keyof typeof airQualityData];

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Wind className="h-4 w-4" />
            Air Quality Monitoring & Control
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Air Pollution Control Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Advanced solutions for monitoring, analyzing, and reducing air pollution in urban environments
          </p>
        </div>

        {/* Real-time AQI Dashboard */}
        <Card className="mb-8 border-blue-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Real-time Air Quality Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              {Object.entries(airQualityData).map(([city, data]) => (
                <Card 
                  key={city}
                  className={`cursor-pointer transition-all ${
                    selectedCity === city ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedCity(city)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{city}</span>
                    </div>
                    <div className={`text-2xl font-bold ${data.color.replace('bg-', 'text-')}`}>
                      {data.aqi}
                    </div>
                    <Badge className={`${data.color} text-white text-xs`}>
                      {data.level}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Current AQI for {selectedCity}</h3>
              <div className={`text-4xl font-bold ${currentAQI.color.replace('bg-', 'text-')} mb-2`}>
                {currentAQI.aqi}
              </div>
              <Badge className={`${currentAQI.color} text-white`}>
                {currentAQI.level}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="monitoring" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="monitoring">Live Monitoring</TabsTrigger>
            <TabsTrigger value="pollutants">Pollutant Analysis</TabsTrigger>
            <TabsTrigger value="solutions">Control Solutions</TabsTrigger>
            <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Pollution Hotspots
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <div>
                        <p className="font-medium">Industrial Zone - Helwan</p>
                        <p className="text-sm text-muted-foreground">PM2.5: 95 μg/m³</p>
                      </div>
                      <Badge variant="destructive">Critical</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium">Highway Ring Road</p>
                        <p className="text-sm text-muted-foreground">NO2: 78 ppb</p>
                      </div>
                      <Badge variant="secondary">High</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium">Downtown Cairo</p>
                        <p className="text-sm text-muted-foreground">PM10: 68 μg/m³</p>
                      </div>
                      <Badge variant="outline">Moderate</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    24-Hour Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">6:00 AM</span>
                      <div className="flex-1 mx-4">
                        <Progress value={85} className="h-2" />
                      </div>
                      <span className="text-sm font-medium">AQI 142</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">12:00 PM</span>
                      <div className="flex-1 mx-4">
                        <Progress value={95} className="h-2" />
                      </div>
                      <span className="text-sm font-medium">AQI 168</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">6:00 PM</span>
                      <div className="flex-1 mx-4">
                        <Progress value={78} className="h-2" />
                      </div>
                      <span className="text-sm font-medium">AQI 125</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">12:00 AM</span>
                      <div className="flex-1 mx-4">
                        <Progress value={65} className="h-2" />
                      </div>
                      <span className="text-sm font-medium">AQI 98</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pollutants">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pollutants.map((pollutant) => (
                <Card key={pollutant.name} className="border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{pollutant.name}</h3>
                        <p className="text-2xl font-bold {pollutant.color}">
                          {pollutant.value} <span className="text-sm font-normal">{pollutant.unit}</span>
                        </p>
                      </div>
                      <Badge className={pollutant.color.includes('red') ? 'bg-red-100 text-red-800' : 
                                      pollutant.color.includes('yellow') ? 'bg-yellow-100 text-yellow-800' : 
                                      'bg-green-100 text-green-800'}>
                        {pollutant.status}
                      </Badge>
                    </div>
                    <Progress 
                      value={pollutant.name === 'PM2.5' ? 78 : pollutant.name === 'PM10' ? 85 : 
                             pollutant.name === 'NO2' ? 45 : 32} 
                      className="h-2" 
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="solutions">
            <div className="grid md:grid-cols-2 gap-6">
              {solutions.map((solution, index) => (
                <Card key={index} className="border-blue-200 hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        {solution.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{solution.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {solution.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Environmental Impact:</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          {solution.impact}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Implementation Cost:</span>
                        <Badge variant="secondary">
                          {solution.cost}
                        </Badge>
                      </div>
                    </div>
                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                      Learn More
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-green-500" />
                    Monthly Progress Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Average AQI Improvement</span>
                      <Badge className="bg-green-100 text-green-800">-12%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>PM2.5 Reduction</span>
                      <Badge className="bg-green-100 text-green-800">-8%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>NO2 Levels</span>
                      <Badge className="bg-green-100 text-green-800">-15%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Green Initiatives</span>
                      <Badge className="bg-blue-100 text-blue-800">+23 Projects</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle>Health Impact Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="font-medium text-green-800">Estimated Lives Saved</p>
                      <p className="text-2xl font-bold text-green-600">1,247</p>
                      <p className="text-sm text-green-600">Due to air quality improvements</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="font-medium text-blue-800">Respiratory Cases Reduced</p>
                      <p className="text-2xl font-bold text-blue-600">-18%</p>
                      <p className="text-sm text-blue-600">Hospital admissions this quarter</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}